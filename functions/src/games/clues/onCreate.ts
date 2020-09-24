import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {Clue, Game, TeamTypes, User} from '../../../../types';

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
            await db.collection('games')
                .doc(gameId)
                .collection('spymaster-chat')
                .add({
                  text:
                      `${name} gave the clue: ${clue.word}, ${clue.guessCount}`,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fromServer: true,
                });
          } else {
            // TODO: handle no spymaster for clue
          }

          return 'Done!';
        });

export async function getSpymasterName(
    gameId: string, clue: Clue): Promise<string> {
  if (clue && clue.team) {
    const game = await getGame(gameId);
    const spymasterId = getSpymasterId(game, clue);

    if (spymasterId) {
      const userSnapshot = await db.collection('users').doc(spymasterId).get();
      const user = userSnapshot.data() as User;

      if (user) {
        // coallesce nickname and name
        return user.nickname || user.name;
      }
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