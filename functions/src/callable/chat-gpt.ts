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

function isClueResponse(v: unknown): v is CodenamesClueResponse {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.hint === 'string' && typeof obj.number === 'number' &&
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

  const prompt = buildCluePrompt(
      playerWords, opponentWords, neutralWords, bombWord, previousClues);

  let clue: CodenamesClueResponse;
  try {
    clue = await complete(
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

  await sendSpymasterMessage(
      db, gameId,
      `The AI generated the hint "${clue.hint} ${clue.number}" for the ${
          team.toLowerCase()} spymaster. Reasoning: \n${clue.reason}`);

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
- "reason": a short explanation of which of your words the hint targets and why
  it is safe (string)
Respond with only the JSON object and nothing else.
`;
}
