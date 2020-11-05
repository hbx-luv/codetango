import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {Clue, Game, TeamTypes} from '../../../../types';
import {sendSpymasterMessage} from '../../util/message';
import {getUserName} from '../../util/user';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
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
    const game = await getGame(gameId);
    const spymasterId = getSpymasterId(game, clue);

    if (spymasterId) {
      return await getUserName(db, spymasterId);
    }
  }

  return '';
}

async function getGame(gameId: string): Promise<Game> {
  const snapshot = await db.collection('games').doc(gameId).get();
  return snapshot.data() as Game;
}

function getSpymasterId(game: Game, clue: Clue): string|undefined {
  if (clue.team === TeamTypes.BLUE) {
    return game.blueTeam.spymaster;
  } else if (clue.team === TeamTypes.RED) {
    return game.redTeam.spymaster;
  }

  // should never get here
  return undefined;
}