import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Game } from '../../../types';


try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is fine
}
const db: admin.firestore.Firestore = admin.firestore();

// the express server that will live inside the cloud function
const app = express();
const main = express();
main.use('/v1', app);
main.use(express.json());

// the actual cloud function
export const api = functions.https.onRequest(main);

app.get('/', async (request, response) => {
  response.send(`
    Will update with some documentation soon
  `);
});

app.get('/games', async (request, response) => {
  const {roomId} = request.query;
  console.log(`roomId: ${roomId}`);

  try {
    // incorporate the roomId if provided
    const query = roomId ? 
        db.collection('games').where('roomId', '==', roomId).orderBy('completedAt', 'desc') : 
        db.collection('games').orderBy('completedAt', 'desc');

    const snapshot = await query.get();
    const games = snapshot.docs.map(doc => {
        const game = doc.data() as Game;
        game.id = doc.id;
        return game;
    });
    response.json(games);
  } catch (error) {
    response.status(500).send({
      error: `could not retrieve games`,
    });
  }
});
