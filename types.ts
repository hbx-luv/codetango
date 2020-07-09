// the team the user/player is on
export enum TeamTypes {
  RED = 'RED',
  BLUE = 'BLUE',
  OBSERVER = 'OBSERVER',
}

// the different types of roles a tile represents
export enum TileRole {
  RED = 'RED',
  BLUE = 'BLUE',
  CIVILIAN = 'CIVILIAN',
  ASSASSIN = 'ASSASSIN',
}

// the various states that the game can be in
export enum GameStatus {
  REDS_TURN = 'REDS_TURN',
  BLUES_TURN = 'BLUES_TURN',
  RED_WON = 'RED_WON',
  BLUE_WON = 'BLUE_WON',
}

// the various states thew room can be in
export enum RoomStatus {
  PREGAME = 'PREGAME',
  ASSIGNING_ROLES = 'ASSIGNING_ROLES',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
  GAME_ENDED = 'GAME_ENDED',
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
  color: TeamTypes;
  userIds: string[];
  spymaster?: string;
}

// The clues that make up a game
export interface Clue {
  word: string;
  guessCount: number;
  createdAt: number;
  team: TeamTypes;
}

export interface Room {
  name: string;
  status: RoomStatus;
  userIds: string[];  // users currently in the room

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

  // client fields
  id?: string;
}

// Stored at /games
export interface Game {
  createdAt: number;
  completedAt?: number;  // optional, set when one team wins
  turnEnds?: number;
  tiles?: Tile[];  // the tiles on the board
  blueTeam: Team;
  redTeam: Team;
  blueAgents: number;  // remaining blue agents
  redAgents: number;   // remaining red agents
  status: GameStatus;
  roomId: string;

  // client fields
  id?: string;
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
  rooms: string[];  // room ids

  // set by some auth providers
  photoURL?: string;

  // set by the stats recalc function
  stats?: UserStats;

  // set by the client
  id?: string;
}

// /wordlists
export interface WordList {
  name: string;
  words: string[];
}

export interface UserStats {
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  spymasterGames: number;
  spymasterWins: number;
  currentStreak: number;
  bestStreak: number;
  provisional: boolean;
  lastPlayed?: number|string;
}

// Snapshot in time of a player's elo rating and other stats after a game has
// been completed
export interface Stats extends UserStats {
  gameId: string;
  userId: string;
  timestamp: number;
}
