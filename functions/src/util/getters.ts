import {Game, User} from '../types';

export async function getUserName(
    db: any,  // RIP, tried to import firestore.Firestore
    userId?: string,
    ): Promise<string> {
  // fail early
  if (!userId) {
    return ''
  }

  const userSnapshot = await db.collection('users').doc(userId).get();
  const user = userSnapshot.data() as User;

  if (user) {
    // coallesce nickname and name
    return user.nickname || user.name;
  }

  return '';
}

export async function getGame(
    db: any,  // RIP, tried to import firestore.Firestore
    gameId: string,
    ): Promise<Game> {
  const snapshot = await db.collection('games').doc(gameId).get();
  return snapshot.data() as Game;
}