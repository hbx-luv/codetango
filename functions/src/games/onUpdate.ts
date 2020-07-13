import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

import {Game, GameStatus, TileRole} from '../../../types';
import {recalcElo} from '../util/elo';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

const db = admin.firestore();

export const onUpdateGame =
    functions.firestore.document('games/{gameId}')
        .onUpdate(async (gameDoc, context) => {
          await updateRemainingAgents(gameDoc.after);
          await determineGameOver(gameDoc.before, gameDoc.after);

          return 'Done';
        });

async function updateRemainingAgents(snapshot: DocumentSnapshot):
    Promise<void> {
  const game = snapshot.data() as Game;

  // only update if there are tiles set
  if (game.tiles && game.tiles.length) {
    let blueAgents = 0;
    let redAgents = 0;

    // determine the remaining blue and red agents
    game.tiles.forEach(tile => {
      if (tile.selected === false) {
        if (tile.role === TileRole.BLUE) {
          blueAgents++;
        } else if (tile.role === TileRole.RED) {
          redAgents++;
        }
      }
    });

    // only update when the # of remaining agents goes down
    if (blueAgents < game.blueAgents || redAgents < game.redAgents) {
      const updates: Partial<Game> = {blueAgents, redAgents};

      // determine if the team won by getting all of their clues
      if (blueAgents === 0) {
        updates.status = GameStatus.BLUE_WON;
        updates.completedAt = Date.now();
      }
      if (redAgents === 0) {
        updates.status = GameStatus.RED_WON;
        updates.completedAt = Date.now();
      }

      await snapshot.ref.update(updates);
    }
  }
}

async function determineGameOver(
    before: DocumentSnapshot, after: DocumentSnapshot) {
  const preGameUpdate = before.data() as Game;
  const postGameUpdate = after.data() as Game;

  // Check if the last update was the game completing
  if (!preGameUpdate.completedAt && postGameUpdate.completedAt) {
    // Process Endgame analytics
    await recalcElo(db, postGameUpdate.completedAt);
  }
}
