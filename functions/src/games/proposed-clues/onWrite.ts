import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';
import {ClueStatus, ProposedClue} from '../../../../types';
import {getSpymasterName} from '../clues';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

const db = admin.firestore();

export const onWriteProposedClues =
    functions.firestore.document('games/{gameId}/proposed-clues/{clueId}')
        .onWrite((clueDoc, context) => {
          const gameId = context.params.gameId;
          return sendSpymasterMessage(gameId, clueDoc.before, clueDoc.after);
        });

async function sendSpymasterMessage(
    gameId: string, before: DocumentSnapshot,
    after: DocumentSnapshot): Promise<void> {
  const clue = after.data() as ProposedClue;

  let text = '';
  const name = await getSpymasterName(gameId, clue);
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

  await db.collection('games').doc(gameId).collection('spymaster-chat').add({
    text,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    fromServer: true,
  });
}