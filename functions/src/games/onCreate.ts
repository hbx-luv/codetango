import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {Game, GameStatus, Tile, TileRole} from '../../../types';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

export const onCreateGame =
    functions.firestore.document('games/{gameId}')
        .onCreate(async (snapshot, _context) => {
          // Add the random stuff to this game
          const gameReference = snapshot.ref;
          const gameSnapShot = await gameReference.get();
          const game = gameSnapShot.data() as Game;

          // Add 25 random cards to the game
          const tiles = generateNewGameTiles();
          game.tiles = tiles;
          const blueTeamNumberOfTiles =
              tiles.filter(tile => tile.role === TileRole.BLUE);
          if (blueTeamNumberOfTiles.length === 9) {
            game.blueAgents = 9;
            game.redAgents = 8;
            game.status = GameStatus.BLUES_TURN;
          } else {
            game.blueAgents = 8;
            game.redAgents = 9;
            game.status = GameStatus.REDS_TURN;
          }

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

function getTwentyFiveWords(): string[] {
  // Fetch words from the word list
  // if we have previous words, avoid those words somehow

  const hardcodedfornow = [
    'AFRICA', 'AGENT',     'AIR',      'ALIEN',     'ALPS',
    'AMAZON', 'AMBULANCE', 'AMERICA',  'ANGEL',     'ANTARCTICA',
    'APPLE',  'ARM',       'ATLANTIS', 'AUSTRALIA', 'AZTEC',
    'BACK',   'BALL',      'BAND',     'BANK',      'BAR',
    'BARK',   'BAT',       'BATTERY',  'BEACH',     'BEAR'
  ];
  return hardcodedfornow;
}

function generateNewGameTiles(): Tile[] {
  const words = getTwentyFiveWords()
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
