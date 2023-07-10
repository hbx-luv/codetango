import * as admin from 'firebase-admin';
import {DocumentSnapshot} from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import {map, uniqBy} from 'lodash';

import {Clue, Tile} from '../../types';
import {getGame, getUserName} from '../../util/getters';
import {sendSpymasterMessage} from '../../util/message';

try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is fine
}

const db = admin.firestore();

export const onUpdateClue =
    functions.firestore.document('games/{gameId}/clues/{clueId}')
        .onUpdate(async (doc, context) => {
          const gameId = context.params.gameId;

          const before = doc.before.exists ? doc.before.data() as Clue : null;
          const after = doc.after.exists ? doc.after.data() as Clue : null;

          if (after) {
            await sanitizeGuessesMade(after, doc.after);

            // don't send the guess message for games with picture tiles
            const game = await getGame(db, gameId);
            if (!game.hasPictures && !game.hasEmojis) {
              await sendGuessMessage(before, after, gameId);
            }
          }
          return 'Done';
        });

/**
 * Remove duplicates from the guessesMade array and if they clicked on an tile
 * that did not match the others, float those to the end of the list
 * @param clue
 */
async function sanitizeGuessesMade(
    clue: Clue, snapshot: DocumentSnapshot): Promise<void> {
  const {guessesMade, team} = clue;

  if (guessesMade) {
    const sanitized =
        uniqBy(guessesMade, 'word').sort((a, b) => sortGuesses(team, a, b));

    if (hash(guessesMade) !== hash(sanitized)) {
      console.log('guessesMase sanitized!!', guessesMade, sanitized);
      clue.guessesMade = sanitized;
      await snapshot.ref.update({guessesMade: sanitized});
    } else {
      console.log('guessesMade is fine');
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

/**
 * Determine if there is a new guess made and then add a message to the
 * spymaster chat
 * @param before
 * @param after
 * @param gameId
 */
async function sendGuessMessage(
    before: Clue|null, after: Clue, gameId: string) {
  const newGuess = getNewGuess(before, after);

  if (newGuess) {
    const name = await getUserName(db, newGuess.selectedBy);
    if (name) {
      const dartOrNot = newGuess.dartedBy ? 'darted' : 'clicked on';
      await sendSpymasterMessage(
          db, gameId, `${name} ${dartOrNot} ${newGuess.word}`);
    } else {
      console.log('no record of who clicked this tile?!');
    }
  }

  return 'Done!';
}

/**
 * Given the snapshots of before and after, see if there was a new guess made
 * @param before
 * @param after
 */
function getNewGuess(before: Clue|null, after: Clue): Tile|null {
  // sanitize down to something safe we can work with
  const beforeGuesses = before ? before.guessesMade || [] : [];
  const afterGuesses = after ? after.guessesMade || [] : [];

  // if we have exactly one new guess from what we knew before
  if (beforeGuesses.length + 1 === afterGuesses.length) {
    return afterGuesses[afterGuesses.length - 1];
  }

  // no new guess
  return null;
}