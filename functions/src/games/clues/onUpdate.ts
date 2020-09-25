import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';
import {map, uniqBy} from 'lodash';

import {Clue, Tile} from '../../../../types';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

export const onUpdateClue =
    functions.firestore.document('games/{gameId}/clues/{clueId}')
        .onUpdate(async (clueDoc, context) => {
          await sanitizeGuessesMade(clueDoc.after);
          return 'Done';
        });

/**
 * Remove duplicates from the guessesMade array and if they clicked on an tile
 * that did not match the others, float those to the end of the list
 * @param snapshot
 */
async function sanitizeGuessesMade(snapshot: DocumentSnapshot): Promise<void> {
  if (snapshot.exists) {
    const {guessesMade, team} = snapshot.data() as Clue;

    if (guessesMade) {
      const sanitized =
          uniqBy(guessesMade, 'word').sort((a, b) => sortGuesses(team, a, b));

      if (hash(guessesMade) !== hash(sanitized)) {
        console.log('guessesMase sanitized!!', guessesMade, sanitized);
        await snapshot.ref.update({guessesMade: sanitized});
      } else {
        console.log('guessesMade is fine');
      }
    }
  }
}

function sortGuesses(team: string, a: Tile, b: Tile): number {
  // roles and teams both have RED and BLUE but aren't technically the
  // same type - nasty!
  const aCorrect = a.role.toString() === team.toString();
  const bCorrect = b.role.toString() === team.toString();

  // if both guesses were correct leave them where they are
  // in the very fucked up case that they're both incorrect, also leave
  // them where they lie, but this should only happen if several people
  // are clicking at once #68
  if (aCorrect === bCorrect) {
    return 0;
  }

  // move the incorrect guesses to the right
  return aCorrect ? -1 : 1;
}

function hash(guessesMade: Tile[]): string {
  return map(guessesMade, 'word').join('_');
}