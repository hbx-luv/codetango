import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

try {
  admin.initializeApp()
} catch (e) {
  console.log(e)
}
const db = admin.firestore();

import * as _ from 'lodash';
import {recalcElo, nukeEloHistoryForGame} from '../util/elo';
import {Game} from '../../../types';

export const onDeleteGame =
    functions.firestore.document('games/{gameId}').onDelete(gameDoc => {
      const game = {id: gameDoc.id, ...gameDoc.data()} as Game
      return handleGameDeleted(game);
    });

async function handleGameDeleted(game: Game) {
  // add deleted games to a deletedGames collection so we can restore them in
  // the future
  await db.collection('deletedGames').add(game);

  // delete this elo history record and recalc elo, update league game stats
  await nukeEloHistoryForGame(db, game.id!);
  await recalcElo(db, game.createdAt, game);
}