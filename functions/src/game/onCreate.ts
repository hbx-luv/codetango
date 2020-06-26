import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// import {CoordinateMap, Game, Move, Outcome, Piece} from '../../../../types';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}
const db = admin.firestore();


export const onCreateGame =
  functions.firestore.document('games/{gameId}')
    .onCreate(async (snapshot, _context) => {
      // Add the random stuff to this game

    });
