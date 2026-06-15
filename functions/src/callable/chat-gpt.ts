import axios from 'axios';
import * as admin from 'firebase-admin';
import {onCall} from 'firebase-functions/v2/https';

import {Game} from '../types';
import {sendSpymasterMessage} from '../util/message';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}

const db = admin.firestore();

export const askChatGpt = onCall(async (req) => {
  const gameAndTeam = req.data as string;
  const [gameId, team] = gameAndTeam.split('_');
  return getClue(gameId, team);
});

async function getClue(gameId: string, team: string) {
  const gameSnapshot = await db.collection('games').doc(gameId).get();
  const cluesSnapshot = await gameSnapshot.ref.collection('clues').get();
  const previousClues = cluesSnapshot.docs.map(doc => doc.data())
                            .filter(clue => clue.team === team)
                            .map(clue => clue.word) ??
      [];

  const {tiles = []} = gameSnapshot.data() as Game;
  const playerWords: string[] = [];
  const opponentWords: string[] = [];
  const neutralWords: string[] = [];
  let bombWord = '';
  for (const tile of tiles) {
    // selected words are disregarded
    if (tile.selected) continue;

    const {word = '', role} = tile;
    if (role === 'ASSASSIN') {
      bombWord = word;
    } else if (role === 'CIVILIAN') {
      neutralWords.push(word);
    } else if (role === team) {
      playerWords.push(word);
    } else {
      opponentWords.push(word);
    }
  }

  const postData = JSON.stringify({
    playerWords,
    opponentWords,
    neutralWords,
    previousClues,
    bombWord,
  });
  console.log(postData);

  const options = {
    url: 'https://codenames-with-gpt.netlify.app/api/clue',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString()
    },
    data: postData,
  };

  const {data} = await axios(options);

  await sendSpymasterMessage(
      db, gameId,
      `ChatGPT generated the hint "${data.hint} ${data.number}" for the ${
          team.toLowerCase()} spymaster. Reasoning: \n${data.reason}`);

  return data;
}
