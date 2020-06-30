import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {Game, GameStatus, Tile, TileRole, WordList} from '../../../types';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

const db = admin.firestore();

export const onCreateGame =
    functions.firestore.document('games/{gameId}')
        .onCreate(async (snapshot, _context) => {
          // Add the random stuff to this game
          const gameReference = snapshot.ref;
          const gameSnapShot = await gameReference.get();
          const game = gameSnapShot.data() as Game;

          // Add 25 random cards to the game
          const tiles = await generateNewGameTiles(game.roomId);
          game.tiles = tiles;
          const blueTeamTiles =
              tiles.filter(tile => tile.role === TileRole.BLUE);
          const redTeamTiles = tiles.filter(tile => tile.role === TileRole.RED);

          game.blueAgents = blueTeamTiles.length;
          game.redAgents = redTeamTiles.length;
          game.status = blueTeamTiles.length > redTeamTiles.length ?
              GameStatus.BLUES_TURN :
              GameStatus.REDS_TURN;
          game.createdAt = new Date().getTime();

          return gameReference.update(game);
        });

function assignRandomTileTeams():
    {red: number[], blue: number[], assassin: number} {
  const assignedNumbers: number[] = [];
  const firstTeam = [];
  const secondTeam = [];

  // the team with 9
  for (let i = 0; i < 9; i++) {
    let randomFirstTeamNumber;
    do {
      // Should be a unique number 0-24
      randomFirstTeamNumber = Math.floor(Math.random() * 25)
    } while (assignedNumbers.includes(randomFirstTeamNumber));

    // Add to first team
    firstTeam.push(randomFirstTeamNumber)
    assignedNumbers.push(randomFirstTeamNumber)
  }

  // the team with 8
  for (let i = 0; i < 8; i++) {
    let randomSecondTeamNumber;
    do {
      // Should be a unique number 0-24
      randomSecondTeamNumber = Math.floor(Math.random() * 25)
    } while (assignedNumbers.includes(randomSecondTeamNumber));

    // Add to second team
    secondTeam.push(randomSecondTeamNumber)
    assignedNumbers.push(randomSecondTeamNumber)
  }

  // Assassin
  let randomAssassinNumber;
  do {
    // Should be a unique number 0-24
    randomAssassinNumber = Math.floor(Math.random() * 25)
  } while (assignedNumbers.includes(randomAssassinNumber));
  const assassin = randomAssassinNumber;

  // Which team goes first?
  const randomNumber = Math.floor(Math.random() * 2);
  let blue = [];
  let red = [];
  if (randomNumber === 0) {
    blue = firstTeam;
    red = secondTeam;
  } else {
    red = firstTeam;
    blue = secondTeam;
  }

  return {
    blue, red, assassin
  }
}

async function generateNewGameTiles(roomId: string): Promise<Tile[]> {
  const words = await getTwentyFiveWords(roomId)
  const tiles = words.map(word => {
    return {
      word, role: TileRole.CIVILIAN, selected: false
    }
  });

  // Assign random teams to the tiles
  const tileTeams = assignRandomTileTeams();
  tileTeams.red.forEach(red => {tiles[red].role = TileRole.RED});
  tileTeams.blue.forEach(blue => {tiles[blue].role = TileRole.BLUE});
  tiles[tileTeams.assassin].role = TileRole.ASSASSIN;

  return tiles;
}

async function getTwentyFiveWords(roomId: string): Promise<string[]> {
  const defaultWordListSnapshot =
      await db.collection('wordlists').doc('default').get();
  if (defaultWordListSnapshot.exists && defaultWordListSnapshot.data()) {
    console.log('defaultWords exists');
    const newWordsForGame = [] as string[];
    const {words} = defaultWordListSnapshot.data() as WordList;

    console.log('looking up words from last game');
    const lastGameWords = await getLastGameWords(roomId);
    console.log(
        lastGameWords.length ? 'avoiding words from last game' :
                               'there is no previous game');

    while (newWordsForGame.length < 25) {
      const randomIndex = Math.floor(Math.random() * words.length);
      const word = words.splice(randomIndex, 1)[0];

      // ensure no dupes (since there are some in the word list) and don't reuse
      // words from the last game
      if (!newWordsForGame.includes(word) && !lastGameWords.includes(word)) {
        newWordsForGame.push(word);
      }
    }

    console.log('newWordsForGame has ' + newWordsForGame.length + ' words.');
    return newWordsForGame;
  } else {
    console.log('defaultWords did not exist')
    const hardcodedfornow = [
      'AFRICA', 'AGENT',     'AIR',      'ALIEN',     'ALPS',
      'AMAZON', 'AMBULANCE', 'AMERICA',  'ANGEL',     'ANTARCTICA',
      'APPLE',  'ARM',       'ATLANTIS', 'AUSTRALIA', 'AZTEC',
      'BACK',   'BALL',      'BAND',     'BANK',      'BAR',
      'BARK',   'BAT',       'BATTERY',  'BEACH',     'BEAR'
    ];
    return hardcodedfornow;
  }
}

/**
 * Given a roomId, return the words from the last game, or an empty array if
 * there is no previous game for this room
 */
async function getLastGameWords(roomId: string) {
  const snapshot = await db.collection('games')
                       .where('roomId', '==', roomId)
                       .orderBy('createdAt', 'desc')
                       .limit(1)
                       .get();

  // no previous game, womp womp
  if (snapshot.empty) return [];

  // return the list of words from the previous game
  const lastGame = snapshot.docs[0].data() as Game;
  return lastGame.tiles.map(t => t.word);
}