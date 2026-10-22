import type {firestore} from 'firebase-admin';

// the team the user/player is on
export enum TeamType {
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

// status to track a proposed clue's status
export enum ClueStatus {
  WAITING = 'WAITING',
  CANCELED = 'CANCELED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export enum UserRole {
  ADMIN = 'Admin',
}

// the word/image to display on the board as well as information about
// the team/role it's tied to and whether or not it has been selected
export interface Tile {
  word?: string;
  image?: string;
  role: TileRole;
  dartedBy?: TileRole;
  selected: boolean;
  selectedBy?: string;  // user who clicked
}

// The players that make up a team
export interface Team {
  color: TeamType;
  userIds: string[];
  spymaster?: string;
}

// The clues that make up a game
export interface Clue {
  word: string;
  guessCount: string;
  maxGuesses: number;
  guessesMade: Tile[];
  createdAt: number;
  team: TeamType;

  // assigned by client
  id?: string;
}

export interface ProposedClue extends Clue {
  status: ClueStatus;
}

// The shape of a spymaster clue returned by the LLM clue generator. Mirrors the
// root `types.ts` definition so a shape drift between the callable and the
// frontend's chat-gpt.service.ts is a compile error.
export interface CodenamesClueResponse {
  hint: string;
  number: number;
  reason: string;
  // The spymaster's own board words it expects operatives to find from this
  // hint. Optional because the model can omit it and the guard stays lenient.
  targetWords?: string[];
}

export interface Room {
  name: string;
  status: RoomStatus;
  userIds: string[];  // users currently in the room

  redReady: boolean;
  blueReady: boolean;

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

  // seconds to increment the turn timer by after each correct guess
  guessIncrement?: number;

  // word list, optional
  // server defaults to 'original'
  wordList?: string;

  // when provided, use this string as a seed for the ChatGPT prompt to generate
  // words to use
  aiWordlistTheme?: string;

  // client fields
  id?: string;
  exists?: boolean;
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
  gameType: GameType;

  roomId: string;
  // true for games that are using pictures
  hasPictures?: boolean;
  hasEmojis?: boolean;

  // set by the server for querying
  userIds?: string[];

  // touched by the bot Cloud Function to re-trigger itself when its drain
  // loop hits the deadline with actions still pending
  botPing?: number;

  // client fields
  id?: string;
  exists?: boolean;
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
  role?: UserRole;

  nickname?: string;

  // set by some auth providers
  photoURL?: string;

  // set by the stats recalc function
  stats?: UserStats;

  // true for synthetic bot players. Bots have no auth account; their moves are
  // performed server-side by the bot Cloud Functions via the admin SDK.
  isBot?: boolean;

  // set by the client
  id?: string;
  rank?: number;
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
  spymasterStreak: number;
  spymasterBestStreak: number;
  assassinsAsSpymaster: number;
  currentStreak: number;
  bestStreak: number;
  provisional: boolean;
  ally?: string;
  nemesis?: string;
  lastPlayed?: number|string;
}

// Snapshot in time of a player's elo rating and other stats after a game has
// been completed
// /eloHistory collection
export interface Stats extends UserStats {
  gameId: string;
  userId: string;
  timestamp: number;
}

export enum MessageType {
  BLUE_TEAM = 'BLUE_TEAM',
  RED_TEAM = 'RED_TEAM',
  OBSERVER = 'OBSERVER',
  EVENT = 'EVENT',
}

export interface Message {
  text: string;
  timestamp: firestore.FieldValue;

  // server messages are styled differently
  fromServer?: boolean;

  // for messages created by users
  userId?: string;
  team?: TeamType;
}

export interface UserToUserStats {
  myUserId: string;
  theirUserId: string;
  gameId: string;
  timestamp: number;
  totalGames: number;
  totalWith: number;
  totalAgainst: number;
  wonWith: number;
  wonAgainst: number;
}

export enum GameType {
  WORDS = 'WORDS',
  PICTURES = 'PICTURES',
  EMOJIS = 'EMOJIS',
  MEMES = 'MEMES',
  EMOJI_REMIX = 'EMOJI_REMIX',

  // first version of emojis RIP
  LEGACY_EMOJIS = 'LEGACY_EMOJIS',
}

// ---------------------------------------------------------------------------
// Blue/green stats storage
// ---------------------------------------------------------------------------

// Elo history and user-to-user history live in one of two interchangeable
// collection sets. Exactly one set is "live" at a time; /system/stats says
// which. A recalc job builds the *other* set from scratch, flips the pointer
// in a single write, then deletes the previous set. Clients never see a
// half-built history.
export enum StatsSet {
  BLUE = 'blue',
  GREEN = 'green',
}

export interface StatsCollections {
  elo: string;
  u2u: string;
}

// The blue set keeps the original collection names so existing data stays
// live with no migration.
export const STATS_COLLECTIONS: Record<StatsSet, StatsCollections> = {
  [StatsSet.BLUE]: {elo: 'eloHistory', u2u: 'userToUserHistory'},
  [StatsSet.GREEN]: {elo: 'eloHistoryGreen', u2u: 'userToUserHistoryGreen'},
};

export const DEFAULT_STATS_SET = StatsSet.BLUE;

export function otherStatsSet(set: StatsSet): StatsSet {
  return set === StatsSet.BLUE ? StatsSet.GREEN : StatsSet.BLUE;
}

// /system/stats — publicly readable pointer to the live set.
export interface StatsConfig {
  liveSet: StatsSet;
  flippedAt?: number;
  jobId?: string;
}

// ---------------------------------------------------------------------------
// Admin recalc / merge jobs
// ---------------------------------------------------------------------------

// Phases of an admin-triggered merge/recalc job, in order:
//   clearing -> migrating -> seeding -> recalculating -> committing -> done
// (migrating and seeding are skipped for a plain recalc), or any -> error.
export enum RecalcPhase {
  CLEARING = 'clearing',
  MIGRATING = 'migrating',
  SEEDING = 'seeding',
  RECALCULATING = 'recalculating',
  COMMITTING = 'committing',
  DONE = 'done',
  ERROR = 'error',
}

export enum RecalcJobType {
  MERGE = 'merge',
  RECALC = 'recalc',
}

// How the recalculating phase picks games.
//   FULL — every completed game, in order (plain recalc).
//   WEB  — a queue seeded with the merged games; each game processed queues
//          every player's next game, so only games downstream of a change
//          are visited and the phase ends when the queue runs dry.
export enum RecalcMode {
  FULL = 'full',
  WEB = 'web',
}

export enum CommitStep {
  USERS = 'users',
  NUKE_OLD_SET = 'nuke_old_set',
  CLEANUP = 'cleanup',
}

// One account merge: every reference to oldUserId becomes newUserId.
export interface MergePair {
  oldUserId: string;
  newUserId: string;
  oldUserName?: string;
  newUserName?: string;
}

// Live status doc at /adminJobs/current. Written only by the Cloud Function;
// the admin page reads it via docData() to render progress.
export interface RecalcJob {
  jobId: string;
  type: RecalcJobType;
  phase: RecalcPhase;

  // Incremented every time a step is claimed. The admin/continue trigger
  // carries the seq it expects, so a duplicate delivery can't run a step
  // twice.
  seq: number;

  // merge-only; empty for a plain recalc
  pairs: MergePair[];

  // Which set was live when the job started, and which set it builds into.
  liveSet: StatsSet;
  buildSet: StatsSet;

  recalcMode: RecalcMode;

  // Earliest completedAt touched by the merge (0 for a full recalc). Only
  // informational for WEB mode: the queue decides what gets rebuilt.
  recalcFrom: number;

  // False when the job turned out to have nothing to rebuild (merge with no
  // completed games) — the live set is left as is and nothing is nuked.
  flip: boolean;

  // clearing
  clearedDocs: number;
  totalClearDocs: number;

  // migrating
  migratedGames: number;
  totalMigrateGames: number;
  migratePairIndex: number;
  migrateCursor?: string;  // last game doc id rewritten for the current pair

  // seeding
  seededDocs: number;
  totalSeedDocs: number;
  seedCollectionIndex: number;  // 0 = elo history, 1 = user-to-user
  seedCursorTimestamp?: number;
  seedCursorId?: string;

  // recalculating. In WEB mode totalGames is an upper bound (every game
  // after recalcFrom) and queueSize is the live frontier.
  processedGames: number;
  totalGames: number;
  queueSize: number;
  cursorTimestamp: number;

  // committing
  committedItems: number;
  totalCommitItems: number;
  commitStep?: CommitStep;

  // timing (ms since epoch)
  startedAt: number;
  updatedAt: number;
  phaseStartedAt: number;
  finishedAt?: number;

  // populated when phase === ERROR
  error?: string;

  // Non-fatal things that happened mid-job and deserve a look, e.g. a game
  // deleted while the rebuild was running.
  warnings?: string[];
}
