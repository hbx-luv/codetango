import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

import {ClueStatus, ProposedClue} from '../../../../types';
import {sendSpymasterMessage} from '../../util/message';
import {getSpymasterName} from '../clues';

try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is ok
}

const db = admin.firestore();

export const onWriteProposedClues =
    functions.firestore.document('games/{gameId}/proposed-clues/{clueId}')
        .onWrite((clueDoc, context) => {
          const gameId = context.params.gameId;
          return sendMessage(gameId, clueDoc.before, clueDoc.after);
        });

async function sendMessage(
    gameId: string, before: DocumentSnapshot,
    after: DocumentSnapshot): Promise<void> {
  const clue = after.data() as ProposedClue;

  const name = await getSpymasterName(gameId, clue);
  if (!name) {
    console.log('No name for spymaster');
    return;
  }

  let text = '';
  const {word, guessCount} = clue;

  // status change
  if (before.exists) {
    if (clue.status === ClueStatus.CANCELED) {
      text = `${name} canceled their request`;
    } else {
      text = `${word}, ${guessCount} ${clue.status.toLowerCase()}!`;
    }
  }

  // creation
  else {
    text = `${name} is proposing: ${word}, ${guessCount}`;
  }

  // add to spymaster chat
  await sendSpymasterMessage(db, gameId, text);
}