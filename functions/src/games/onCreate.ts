import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {shuffle} from 'lodash';

import {Game, GameStatus, GameType, Room, Tile, TileRole, WordList} from '../types';

try {
  admin.initializeApp();
} catch (e) {
  // do nothing, this is fine
}

const db = admin.firestore();


// @ts-ignore
function getGameType(game: Game, wordList: string): GameType {
  if (game) {
    if (game?.gameType) {
      return game.gameType;
    } else if (game.hasPictures) {
      if (wordList === 'memes') {
        return GameType.MEMES;
      } else if (wordList === 'pictures') {
        return GameType.PICTURES;
      }
    } else if (game.hasEmojis) {
      // hardcoded legacy timestamp of the last game to play with the initial
      // (legacy) version of codenames emojis
      if (game.createdAt < 1604606378903) {
        return GameType.LEGACY_EMOJIS;
      } else {
        if (wordList === "emoji-remix") {
          return GameType.EMOJI_REMIX;
        }
        return GameType.EMOJIS;
      }
    }
  }  // else
  if (wordList === 'pictures') {
    return GameType.PICTURES;
  } else if (wordList === 'memes') {
    return GameType.MEMES;
  } else if (wordList === 'emojis') {
    return GameType.EMOJIS;
  } else if (wordList === 'emoji-remix') {
    return GameType.EMOJI_REMIX
  }
  return GameType.WORDS;
}

export const onCreateGame =
    functions.firestore.document('games/{gameId}')
        .onCreate(async (snapshot, context) => {
          // Add the random stuff to this game
          const gameReference = snapshot.ref;
          const gameSnapShot = await gameReference.get();
          const game = gameSnapShot.data() as Game;

          const updates: Partial<Game> = {};

          // Add 25 random cards to the game if there are no tiles
          // If the game is created with tiles already set, this game was
          // probably migrated. Do not modify any of the other fields
          if (!game.tiles) {
            const wordList = await getWordList(game.roomId);

            updates.hasPictures =
                (wordList === 'pictures' || wordList === 'memes');
            updates.hasEmojis = wordList === 'emojis' || wordList === 'emoji-remix';
            updates.gameType = getGameType(game, wordList);
            updates.tiles = await generateNewGameTiles(wordList);
            const blueTeamTiles = updates.tiles.filter(
                tile => tile.role === TileRole.BLUE && !tile.selected);
            const redTeamTiles = updates.tiles.filter(
                tile => tile.role === TileRole.RED && !tile.selected);

            updates.blueAgents = blueTeamTiles.length;
            updates.redAgents = redTeamTiles.length;
            updates.status = blueTeamTiles.length > redTeamTiles.length ?
                GameStatus.BLUES_TURN :
                GameStatus.REDS_TURN;
            updates.createdAt = new Date().getTime();

            // save updates
            await gameReference.update(updates);
          }

          return 'Done!';
        });

async function generateNewGameTiles(wordList: string): Promise<Tile[]> {
  const words = await getWords(wordList);
  const tiles = words.map(word => {
    return {
      word, role: TileRole.CIVILIAN, selected: false
    }
  });

  // get red, blue, and assassin counts
  // assign the roles then shuffle the tiles
  const {red, blue, assassins} = getRoleCounts(wordList);
  for (let i = 0; i < red; i++) {
    tiles[i].role = TileRole.RED;
  }
  for (let i = red; i < red + blue; i++) {
    tiles[i].role = TileRole.BLUE;
  }
  for (let i = red + blue; i < red + blue + assassins; i++) {
    tiles[i].role = TileRole.ASSASSIN;
  }

  return shuffle(tiles);
}

async function getWords(wordList: string): Promise<string[]> {
  const snapshot = await db.collection('wordlists').doc(wordList).get();
  if (snapshot.exists && snapshot.data()) {
    console.log('defaultWords exists');
    const newWordsForGame = [] as string[];
    const {words} = snapshot.data() as WordList;

    const isPictures = (wordList === 'pictures' || wordList === 'memes');
    // in codenames pictures (and memes), you only get 20 tiles
    const count = isPictures ? 20 : 25;

    while (newWordsForGame.length < count) {
      const randomIndex = Math.floor(Math.random() * words.length);
      const word = words.splice(randomIndex, 1)[0];

      // ensure no dupes (since there are some in the word list)
      if (!newWordsForGame.includes(word)) {
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

async function getWordList(roomId: string): Promise<string> {
  const roomSnapshot = await db.collection('rooms').doc(roomId).get();
  return (roomSnapshot.data() as Room).wordList || 'original';
}

function getRoleCounts(wordList: string) {
  const random = Math.round(Math.random());
  if (wordList === 'pictures' || wordList === 'memes') {
    return random ? {red: 7, blue: 8, assassins: 1} :
                    {red: 8, blue: 7, assassins: 1};
  } else {
    return random ? {red: 8, blue: 9, assassins: 1} :
                    {red: 9, blue: 8, assassins: 1};
  }
}
