import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {Clue, Game, TeamType} from '../../types';
import {getGame, getUserName} from '../../util/getters';
import {sendSpymasterMessage} from '../../util/message';

try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is fine
}

const db = admin.firestore();

/**
 * When clues are created, add a server message to the spymaster chat
 */
export const onCreateClue =
    functions.firestore.document('games/{gameId}/clues/{clueId}')
        .onCreate(async (snapshot, context) => {
          const gameId = context.params.gameId;

          const clueReference = snapshot.ref;
          const clueSnapShot = await clueReference.get();
          const clue = clueSnapShot.data() as Clue;

          const name = await getSpymasterName(gameId, clue);

          if (name) {
            await sendSpymasterMessage(
                db, gameId,
                `${name} gave the clue: ${clue.word}, ${clue.guessCount}`);
          } else {
            console.log('no spymaster?!');
          }

          return 'Done!';
        });

export async function getSpymasterName(
    gameId: string, clue: Clue): Promise<string> {
  if (clue && clue.team) {
    const game = await getGame(db, gameId);
    const spymasterId = getSpymasterId(game, clue);

    if (spymasterId) {
      return await getUserName(db, spymasterId);
    }
  }

  return '';
}

function getSpymasterId(game: Game, clue: Clue): string|undefined {
  if (clue.team === TeamType.BLUE) {
    return game.blueTeam.spymaster;
  } else if (clue.team === TeamType.RED) {
    return game.redTeam.spymaster;
  }

  // should never get here
  return undefined;
}