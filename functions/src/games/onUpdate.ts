import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';
import {without} from 'lodash';

import {Game, GameStatus, TileRole, User} from '../../../types';
import {recalcElo} from '../util/elo';
import {sendSpymasterMessage} from '../util/message';

try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is ok
}

const db = admin.firestore();

export const onUpdateGame =
    functions.firestore.document('games/{gameId}')
        .onUpdate(async (gameDoc, context) => {
          await updateRemainingAgents(gameDoc.after);
          await determineGameOver(gameDoc.after);
          await sanitizeBoard(gameDoc.before, gameDoc.after);

          return 'Done';
        });

/**
 * This function serves as a sanity check to end the game if either team reaches
 * 0 remaining agents. The client has this information as well, but in the case
 * of double clicks, or anything else going wrong, this function will crawl the
 * board to determine the number of remaining agents for each team
 * @param snapshot
 */
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

    const updates: Partial<Game> = {};

    // only update when the # of remaining agents when it changes
    if (blueAgents !== game.blueAgents) {
      updates.blueAgents = blueAgents;
    }
    if (redAgents !== game.redAgents) {
      updates.redAgents = redAgents;
    }

    // determine if the team won by getting all of their clues
    if (!game.completedAt) {
      if (blueAgents === 0) {
        updates.status = GameStatus.BLUE_WON;
        updates.completedAt = Date.now();
      }
      if (redAgents === 0) {
        updates.status = GameStatus.RED_WON;
        updates.completedAt = Date.now();
      }
    }

    // only make the request when there are updates
    if (Object.keys(updates).length > 0) {
      await snapshot.ref.update(updates);
    }
  }
}

async function determineGameOver(after: DocumentSnapshot) {
  const postGameUpdate = after.data() as Game;

  if (postGameUpdate.completedAt) {
    // Process Endgame analytics if the game is over
    await recalcElo(db, postGameUpdate.completedAt);

    // Then add this room to the user's list of rooms
    await addRoomToUsers(postGameUpdate);
  }
}

async function addRoomToUsers(game: Game) {
  const {roomId, blueTeam, redTeam} = game;

  // fetch the existing rooms for each user and put this roomId first in the
  // list, then add all the others behind
  await Promise.all(
      blueTeam.userIds.concat(redTeam.userIds).map(async userId => {
        const userRef = db.collection('users').doc(userId);
        const userSnapshot = await userRef.get();
        const {rooms = []} = userSnapshot.data() as User;
        return userRef.update({rooms: [roomId].concat(without(rooms, roomId))});
      }));
}

async function sanitizeBoard(
    before: DocumentSnapshot, after: DocumentSnapshot): Promise<void> {
  const {tiles: beforeTiles} = before.data() as Game;
  const {tiles: afterTiles} = after.data() as Game;
  let updated = false;

  // Crawl the board seeing if any tile that was previously selected is not
  // selected anymore and select it again. This happens when multiple people
  // click on the board at the same time #68
  if (beforeTiles && beforeTiles.length && afterTiles && afterTiles.length) {
    for (let i = 0; i < beforeTiles.length; i++) {
      if (beforeTiles[i].selected && !afterTiles[i].selected) {
        afterTiles[i] = beforeTiles[i];
        updated = true;
      }
    }
  }

  // only update this document when we determine something is out of sync
  if (updated) {
    const warning =
        'It appears two or more operatives clicked the board at the same time. We tried to fix the board up, but please tell them to only have one clicker in the future.';
    await sendSpymasterMessage(db, after.id, warning);
    await after.ref.update({tiles: afterTiles});
  }
}