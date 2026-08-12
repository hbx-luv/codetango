import {FieldValue} from 'firebase-admin/firestore';

/**
 * Send any given text to the spymaster chat for a given gameId
 * @param db Pass a reference to the admin db
 * @param gameId The game the chat is in
 * @param text The message to send
 */
export async function sendSpymasterMessage(
    db: any,  // RIP, tried to import firestore.Firestore
    gameId: string,
    text: string,
    ): Promise<void> {
  // Import FieldValue from the 'firebase-admin/firestore' subpath rather than
  // the root 'firebase-admin' namespace: under the Functions emulator's admin
  // instrumentation, `firestore.FieldValue` resolves to undefined and every
  // spymaster-chat write throws `Cannot read properties of undefined
  // (reading 'serverTimestamp')`. The subpath export is emulator-safe.
  await db.collection('games').doc(gameId).collection('spymaster-chat').add({
    text,
    timestamp: FieldValue.serverTimestamp(),
    fromServer: true
  });
}

/**
 * Build the succinct spymaster-chat announcement for an AI-generated clue,
 * including the model's reasoning and the words it expects operatives to find.
 * @param who Who gave the clue, e.g. "The red bot" or "The AI (for the red
 *     spymaster)"
 * @param hint The single-word clue
 * @param count The clue's number (or '∞')
 * @param reason The model's short reasoning
 * @param targetWords The board words the clue is aiming its operatives at
 */
export function clueChatMessage(
    who: string,
    hint: string,
    count: string,
    reason: string,
    targetWords: string[],
    ): string {
  const expecting = targetWords.length ?
      ` Expecting operatives to find: ${targetWords.join(', ')}.` :
      '';
  return `${who} gave "${hint} ${count}". ${reason}${expecting}`;
}