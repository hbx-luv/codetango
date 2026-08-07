import * as admin from 'firebase-admin';
import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {CodenamesClueResponse, Game, TeamType} from '../types';
import {buildCluePrompt, CLUE_SCHEMA, isClueResponse, partitionBoard} from '../util/bots';
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

  const {playerWords, opponentWords, neutralWords, bombWord} =
      partitionBoard(game, team as TeamType);

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

