import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

try {
  admin.initializeApp()
} catch (e) {
  console.log(e)
}
const db = admin.firestore();

import {recalcElo} from '../util/elo';

export const onCreateAdmin =
    functions.firestore.document('admin/{action}').onCreate((doc, context) => {
      const action = context.params.action;

      console.log('admin action: ' + action);

      if (action === 'recalc') {
        const data = doc.data();

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
      } else {
        // just delete the action if we don't understand it
        return db.collection('admin')
            .doc(action)
            .delete()
            .then(() => console.log('I don\'t know what you were trying to do'))
            .catch(err => console.log(err));
      }
    });