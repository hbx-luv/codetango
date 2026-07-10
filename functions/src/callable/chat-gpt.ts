import * as admin from 'firebase-admin';
import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {CodenamesClueResponse, Game} from '../types';
import {AllProvidersFailedError, anthropicApiKey, complete} from '../util/llm';
import {sendSpymasterMessage} from '../util/message';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}

const db = admin.firestore();

// Minimum time between clue requests for a given game + team. The clue call now
// spends the project's own Anthropic key (claude-opus-4-8, high effort), so a
// per-(gameId, team) cooldown stops an authenticated spymaster from looping it.
const CLUE_COOLDOWN_MS = 20_000;

const CLUE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['hint', 'number', 'reason'],
  properties: {
    hint: {type: 'string'},
    number: {type: 'integer'},
    reason: {type: 'string'},
  },
};

// Server-side legality guard for a generated hint (case-insensitive). A hint is
// illegal only if it EQUALS a board word or shares a word-root at the START
// boundary — i.e. one word is a PREFIX of the other. English inflections are
// suffixes on a root, so the root is a prefix: `ICE` is a prefix of
// `ICES`/`ICED`/`ICING` (correctly rejected) but NOT of `PRICE` (correctly
// allowed); `CAR` and `SCARE` are prefixes of neither (both allowed). This is
// deliberately looser than a two-directional substring check: a suffix-compound
// like `FOOTBALL` vs board `BALL` will pass — an accepted tradeoff, since
// catching it would also re-reject legal hints like `PRICE`, and the prompt
// still discourages compounds.
function overlapsBoard(boardWords: string[], hint: string): boolean {
  const h = hint.toLowerCase();
  return boardWords.some(w => {
    const b = w.toLowerCase();
    return h.startsWith(b) || b.startsWith(h);
  });
}

function isLegalHint(hint: string, boardWords: string[]): boolean {
  const h = hint.trim();
  // `^[a-zA-Z]+$` enforces single-word (no spaces) + letters-only; it also
  // subsumes the empty/numeric/hyphenated rejections.
  return /^[a-zA-Z]+$/.test(h) && !overlapsBoard(boardWords, h);
}

function isClueResponse(v: unknown): v is CodenamesClueResponse {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  // number must be an integer count — the Anthropic json_schema `integer` backs
  // this today, but the router's contract is that the validator is the contract.
  return typeof obj.hint === 'string' && Number.isInteger(obj.number) &&
      typeof obj.reason === 'string';
}

export const askChatGpt = onCall({secrets: [anthropicApiKey]}, async (req) => {
  // Authorization runs BEFORE any board partitioning or model call, so an
  // unauthorized caller never reads tile roles nor triggers a paid API call.
  if (!req.auth) {
    throw new HttpsError(
        'unauthenticated', 'You must be signed in to request a clue.');
  }

  const gameAndTeam = req.data as string;
  const [gameId, team] = gameAndTeam.split('_');

  // Validate the client-supplied team up front. Anything other than an exact
  // 'RED'/'BLUE' (lowercase, empty, or a missing '_' separator making team
  // undefined) is rejected here, before any board read, model call, or the
  // later `team.toLowerCase()`.
  if (!gameId || (team !== 'RED' && team !== 'BLUE')) {
    throw new HttpsError(
        'invalid-argument',
        'Request must be of the form "<gameId>_RED" or "<gameId>_BLUE".');
  }

  const gameSnapshot = await db.collection('games').doc(gameId).get();
  const game = gameSnapshot.data() as Game | undefined;
  if (!game) {
    throw new HttpsError('not-found', 'Game not found.');
  }

  // SPYMASTER-ONLY: team membership is NOT sufficient. `spymaster` is an
  // optional string holding a Firebase Auth uid (same identifier space as
  // req.auth.uid); when it's undefined the strict equality denies.
  const requestedTeam = team === 'RED' ? game.redTeam : game.blueTeam;
  if (!requestedTeam || req.auth.uid !== requestedTeam.spymaster) {
    throw new HttpsError(
        'permission-denied',
        'Only the spymaster for this team may request a clue.');
  }

  // Rate-limit a newly-billed model call: reject a second clue request for the
  // same game + team inside the cooldown window. A real Firestore transaction so
  // two concurrent calls can't both pass — the loser's callback re-reads the
  // just-written timestamp and is rejected.
  const cooldownRef =
      db.collection('games').doc(gameId).collection('clue-requests').doc(team);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(cooldownRef);
    const now = Date.now();
    const lastRequestedAt =
        snap.exists ? snap.data()?.lastRequestedAt : undefined;
    if (typeof lastRequestedAt === 'number' &&
        now - lastRequestedAt < CLUE_COOLDOWN_MS) {
      throw new HttpsError(
          'resource-exhausted',
          'A clue was just requested for this team. Please wait a few seconds.');
    }
    tx.set(cooldownRef, {lastRequestedAt: now});
  });

  return getClue(gameSnapshot, game, gameId, team);
});

async function getClue(
    gameSnapshot: FirebaseFirestore.DocumentSnapshot,
    game: Game,
    gameId: string,
    team: string,
    ): Promise<CodenamesClueResponse> {
  const cluesSnapshot = await gameSnapshot.ref.collection('clues').get();
  const previousClues = cluesSnapshot.docs.map(doc => doc.data())
                            .filter(clue => clue.team === team)
                            .map(clue => clue.word);

  const {tiles = []} = game;
  const playerWords: string[] = [];
  const opponentWords: string[] = [];
  const neutralWords: string[] = [];
  let bombWord = '';
  for (const tile of tiles) {
    // selected words are disregarded
    if (tile.selected) continue;

    const {word = '', role} = tile;
    if (role === 'ASSASSIN') {
      bombWord = word;
    } else if (role === 'CIVILIAN') {
      neutralWords.push(word);
    } else if (role === team) {
      playerWords.push(word);
    } else {
      opponentWords.push(word);
    }
  }

  const boardWords =
      [...playerWords, ...opponentWords, ...neutralWords, bombWord].filter(
          w => w.length > 0);
  const basePrompt = buildCluePrompt(
      playerWords, opponentWords, neutralWords, bombWord, previousClues);
  const RETRY_NOTE =
      '\n\nYour previous hint was ILLEGAL: it was a word on the board, a ' +
      'substring of one, or not a single English word. Choose a DIFFERENT ' +
      'single word that does not appear on and shares no substring with any ' +
      'board word.';

  // Worst case = 2 Opus-high calls: a provider failure short-circuits without
  // spending the retry; the retry is spent ONLY on a generated-but-illegal
  // hint. No rejected hint is ever persisted.
  let clue: CodenamesClueResponse | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? basePrompt : basePrompt + RETRY_NOTE;
    let candidate: CodenamesClueResponse;
    try {
      candidate = await complete(
          {
            prompt,
            effort: 'high',
            thinking: {type: 'adaptive'},
            schema: CLUE_SCHEMA,
          },
          isClueResponse,
          ['anthropic'],
      );
    } catch (e) {
      if (e instanceof AllProvidersFailedError) {
        // Surface a clean error so the frontend stops spinning.
        throw new HttpsError(
            'unavailable',
            'The clue generator is temporarily unavailable. Please try again.');
      }
      throw e;
    }
    if (isLegalHint(candidate.hint, boardWords)) {
      // `isLegalHint` validates the trimmed hint, so announce/return the
      // trimmed form too — otherwise stray whitespace survives to the chat
      // message and the callable response. `number`/`reason` are unchanged.
      clue = {...candidate, hint: candidate.hint.trim()};
      break;
    }
    console.warn(`illegal AI clue "${candidate.hint}" (attempt ${attempt + 1})`);
  }
  if (!clue) {
    throw new HttpsError(
        'failed-precondition', 'Couldn\'t generate a clue, try again.');
  }

  // NOTE: `spymaster-chat` is world-readable via the `games/{document=**}`
  // Firestore read rule, so the model's free-text `reason` (which can reference
  // the assassin/opponent words) must NOT be persisted here. The reasoning is
  // still returned to the requesting spymaster's client via the callable
  // response below; the chat message only announces the hint and number.
  await sendSpymasterMessage(
      db, gameId,
      `The AI generated the hint "${clue.hint} ${clue.number}" for the ${
          team.toLowerCase()} spymaster.`);

  return clue;
}

function buildCluePrompt(
    playerWords: string[],
    opponentWords: string[],
    neutralWords: string[],
    bombWord: string,
    previousClues: string[],
    ): string {
  const previous = previousClues.length ?
      previousClues.join(', ') :
      '(none yet)';
  return `
You are an expert spymaster in the word game Codenames. Your job is to give a
one-word hint that connects as many of YOUR team's words as possible while
steering your teammates away from every other word on the board.

Board state (each list is a set of single words already on the board):
- YOUR team's words (you want your teammates to guess these): ${playerWords.join(', ')}
- Opponent's words (never lead your team here): ${opponentWords.join(', ')}
- Neutral bystander words (avoid these; a wrong guess ends your turn): ${neutralWords.join(', ')}
- The ASSASSIN word (if your team guesses this, you INSTANTLY LOSE — avoid it at all costs): ${bombWord}
- Hints already given to your team this game (do not reuse them): ${previous}

Rules for your hint:
1. The hint MUST be a single English word. It must NOT be any word appearing on
   the board (in any list above), nor a direct form, plural, or substring of one.
2. The number is how many of YOUR team's words your hint points to. Pick a hint
   that safely connects as many of your words as you confidently can, but never
   at the risk of pointing toward the assassin, an opponent word, or a neutral.
3. Favor a strong, unambiguous connection to your own words over a risky clue
   that touches more words. A clean 2 beats a dangerous 4.
4. Absolutely avoid any semantic path that could lead your team to the assassin
   word "${bombWord}".

Think it through, then respond with a JSON object with exactly these keys:
- "hint": your single-word clue (string)
- "number": the count of your team's words it points to (integer, at least 1)
- "reason": a short explanation of which of YOUR team's words the hint targets
  and why it points only to them (string). Do NOT mention, quote, or spell out
  the assassin word or any other word on the board in this explanation — refer
  to your own target words only.
Respond with only the JSON object and nothing else.
`;
}
