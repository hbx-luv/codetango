// the different types of roles a tile represents
export enum TileRole {
  RED,
  BLUE,
  CIVILIAN,
  ASSASSIN
}

// the various states that the game can be in
export enum GameStatus {
  REDS_TURN,
  BLUES_TURN,
  RED_WON,
  BLUE_WON
}

// the word/image to display on the board as well as information about
// the team/role it's tied to and whether or not it has been selected
export interface Tile {
  word: string;  // support images?
  role: TileRole;
  selected: boolean;
  selectedBy?: string;  // user who clicked
}

// The players that make up a team
export interface Team {
  color: 'red'|'blue';
  spymaster: string;
  userIds: string[];
  elo: number;
}

// Stored at /games
export interface Game {
  createdAt: number;
  completedAt?: number;  // optional, set when one team wins
  tiles: Tile[];         // the tiles on the board
  blueTeam: Team;
  redTeam: Team;
  blueAgents: number;  // remaining blue agents
  redAgents: number;   // remaining red agents
  status: GameStatus;

  // optional fields:

  // seconds to count down from at the start of each turn
  timer?: number;

  // seconds that apply for only the first spymaster on the first round
  // for example, 3 minutes for the first round, 2 minutes for all else
  firstTurnTimer?: number;

  // if true, the current turn ends when the timer runs down
  // for example, 5 total minutes for the blue spymaster to give a hint
  // and for the players to guess
  enforceTimer?: boolean;
}

// /games/{id}/turns
// options collection if we want more analytics
export interface Guess {
  timestamp: number;
  user: string;  // who clicked?
  tile: Tile;
}

// /users
export interface User {
  name: string;
  email: string;
  photoURL?: string;
  elo: number;  // needs to default, 1200?
}

// /wordlists
export interface WordList {
  name: string;
  words: string[];
}