import * as admin from 'firebase-admin';
import {onDocumentDeleted} from 'firebase-functions/v2/firestore';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing
}
const db = admin.firestore();

import {recalcElo, nukeHistoryForGame} from '../util/elo';
import {Game} from '../types';

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

    // delete all history records for this game and then recalc elo
    await nukeHistoryForGame(db, 'eloHistory', game.id!);
    await nukeHistoryForGame(db, 'userToUserHistory', game.id!);
    await recalcElo(db, game.createdAt, game);
  }
}