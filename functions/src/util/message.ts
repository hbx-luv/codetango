import {firestore} from 'firebase-admin';

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
  await db.collection('games').doc(gameId).collection('spymaster-chat').add({
    text,
    timestamp: firestore.FieldValue.serverTimestamp(),
    fromServer: true
  });
}