import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import {BigBatch} from '../util/big-batch';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}
const db = admin.firestore() as any;

import {recalcElo} from '../util/elo';
import {Game} from '../../../types';

export const onCreateAdmin =
    functions.firestore.document('admin/{action}')
        .onCreate(async (doc, context) => {
          const action = context.params.action;
          const data = doc.data();

          console.log('admin action: ' + action);

          // trigger a recalc action
          if (action === 'recalc') {
            console.log('we got a recalc boys: ' + data.timestamp);

            // recalc elo and delete the action
            return recalcElo(db, data.timestamp)
                .then(() => {
                  return doc.ref.delete();
                })
                .then(
                    () => console.log(
                        'recalc elo from ' + data.timestamp + ' complete'))
                .catch(err => console.log(err));
          }

          // migrate a user's games
          else if (action === 'migrate') {
            const {oldUser, newUser} = data;
            return migrateUser(oldUser, newUser)
                .then(() => {
                  // recalc from the beginning of time
                  return recalcElo(db, 0);
                })
                .then(() => {
                  return doc.ref.delete();
                });
          }

          // otherwise just delete the action if we don't understand it
          else {
            return doc.ref.delete()
                .then(
                    () =>
                        console.log('I don\'t know what you were trying to do'))
                .catch(err => console.log(err));
          }
        });

async function migrateUser(oldUser: string, newUser: string): Promise<void> {
  console.log(`migrating all games from ${oldUser} to ${newUser}`);
  const games =
      await db.collection('games')
          .where('userIds', 'array-contains', oldUser)
          .orderBy('completedAt', 'asc')
          .limit(500)  // only do 500 games at a time so we don't timeout
          .get();

  console.log(`${games.size} games got got. starting migration...`);

  const batch = new BigBatch(db);

  for (let i = 0; i < games.size; i++) {
    const game = games.docs[i].data() as Game;

    // replace the old id within the game
    const updates: any = {
      'userIds': replaceInArray(game.userIds!, oldUser, newUser),
      'redTeam.userIds': replaceInArray(game.redTeam.userIds, oldUser, newUser),
      'blueTeam.userIds':
          replaceInArray(game.blueTeam.userIds, oldUser, newUser),
    };

    // make sure we replace spymasters too
    if (game.redTeam.spymaster === oldUser) {
      updates['redTeam.spymaster'] = newUser;
    }
    if (game.blueTeam.spymaster === oldUser) {
      updates['blueTeam.spymaster'] = newUser;
    }

    batch.update(games.docs[i].ref, updates);

    // delete the elo history record for this game
    batch.delete(
        db.collection('eloHistory').doc(`${oldUser}_${games.docs[i].id}`));
  }

  // null out the old user's stats
  batch.update(db.collection('users').doc(oldUser), {stats: null});

  console.log('committing...');
  await batch.commit();
  console.log('complete!');
}

function replaceInArray(array: any[], a: string, b: string) {
  const index = array.indexOf(a);
  if (index >= 0) {
    array.splice(index, 1, b);
  }
  return array;
}