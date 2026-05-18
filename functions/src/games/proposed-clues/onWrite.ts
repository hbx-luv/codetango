import * as admin from 'firebase-admin';
import {DocumentSnapshot} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';

import {ClueStatus, ProposedClue} from '../../types';
import {sendSpymasterMessage} from '../../util/message';
import {getSpymasterName} from '../clues';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}

const db = admin.firestore();

export const onWriteProposedClues =
    onDocumentWritten('games/{gameId}/proposed-clues/{clueId}', (event) => {
          const change = event.data;
          if (!change) return;
          const gameId = event.params.gameId;
          return sendMessage(gameId, change.before, change.after);
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