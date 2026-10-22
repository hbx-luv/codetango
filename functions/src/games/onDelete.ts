import * as admin from 'firebase-admin';
import {onDocumentDeleted} from 'firebase-functions/v2/firestore';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing
}
const db = admin.firestore();

import {recalcElo, nukeHistoryForGame} from '../util/elo';
import {FieldValue} from 'firebase-admin/firestore';

import {Game, RecalcJob, RecalcPhase, STATS_COLLECTIONS} from '../types';

export const onDeleteGame =
    onDocumentDeleted('games/{gameId}', event => {
      const gameDoc = event.data;
      if (!gameDoc) return;
      const game = {...gameDoc.data(), id: gameDoc.id} as Game
      return handleGameDeleted(game);
    });

async function handleGameDeleted(game: Game) {
  // only bother dealing with completed games
  if (game.completedAt) {
    // add deleted games to a deletedGames collection so we can restore them in
    // the future
    await db.collection('deletedGames').add(game);

    // delete all history records for this game from both stats sets (a
    // recalc job may be building the inactive one) and then recalc elo
    for (const {elo, u2u} of Object.values(STATS_COLLECTIONS)) {
      await nukeHistoryForGame(db, elo, game.id!);
      await nukeHistoryForGame(db, u2u, game.id!);
    }
    await recalcElo(db, game.createdAt, game);
    await warnActiveJob(game.id!);
  }
}

// A rebuild in progress has already folded this game into later history in
// the build set, and nothing re-visits it. Flag the job so the admin knows
// to run a full recalc afterwards.
async function warnActiveJob(gameId: string) {
  const ref = db.collection('adminJobs').doc('current');
  const snap = await ref.get();
  if (!snap.exists) return;
  const job = snap.data() as RecalcJob;
  if (job.phase === RecalcPhase.DONE || job.phase === RecalcPhase.ERROR) {
    return;
  }
  await ref.update({
    warnings: FieldValue.arrayUnion(
        `Game ${gameId} was deleted while this job was running. ` +
        `Run "Recalculate all stats" afterwards to be sure.`),
  });
}