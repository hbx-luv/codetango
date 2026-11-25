import * as admin from 'firebase-admin';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';

import {BUILT_IN_GAME_TYPES, Game, GameStatus, GameType, GameWordSource, IMAGE_REF_PREFIX, isPictureGameType, Room, Tile, TileRole, tileCountFor, WORD_LIST_LIMITS, WordList, WordSourceType} from '../types';
import {getThemedWords} from '../util/chatgpt';
import {anthropicApiKey, chatgptApiKey} from '../util/llm';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}

const db = admin.firestore();

const DEFAULT_WORD_LIST = 'original';

// Last-resort board for a project whose word lists were never seeded.
const EMERGENCY_WORDS = [
  'AFRICA', 'AGENT',     'AIR',      'ALIEN',     'ALPS',
  'AMAZON', 'AMBULANCE', 'AMERICA',  'ANGEL',     'ANTARCTICA',
  'APPLE',  'ARM',       'ATLANTIS', 'AUSTRALIA', 'AZTEC',
  'BACK',   'BALL',      'BAND',     'BANK',      'BAR',
  'BARK',   'BAT',       'BATTERY',  'BEACH',     'BEAR'
];

// Everything needed to deal a board: the words (or image refs) on it, how
// they render, and where they came from.
interface Board {
  words: string[];
  gameType: GameType;
  source: GameWordSource;
}

export const onCreateGame =
    onDocumentCreated(
        {
          document: 'games/{gameId}',
          secrets: [chatgptApiKey, anthropicApiKey],
        },
        async (event) => {
          const snapshot = event.data;
          if (!snapshot) return;

          // Add the random stuff to this game
          const gameReference = snapshot.ref;
          const gameSnapShot = await gameReference.get();
          const game = gameSnapShot.data() as Game;

          const updates: Partial<Game> = {};

          // Add random cards to the game if there are no tiles
          // If the game is created with tiles already set, this game was
          // probably migrated. Do not modify any of the other fields
          if (!game.tiles) {
            const board = await buildBoard(await getRoom(game.roomId));

            updates.gameType = board.gameType;
            updates.hasPictures = isPictureGameType(board.gameType);
            updates.hasEmojis = board.gameType === GameType.EMOJIS ||
                board.gameType === GameType.EMOJI_REMIX;
            updates.wordSource = board.source;
            updates.tiles = dealTiles(board);
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
        },
    );

/**
 * Resolve the room's settings into a board. An AI theme wins over a word
 * list; anything that can't produce a full board falls back to the default
 * list rather than dealing a short one.
 */
async function buildBoard(room: Room|undefined): Promise<Board> {
  const {wordList, aiWordlistTheme} = room ?? {};

  if (aiWordlistTheme) {
    const prompt = aiWordlistTheme.slice(0, WORD_LIST_LIMITS.themeLength);
    try {
      const pool = await getThemedWords(prompt);
      return {
        words: pool.slice(0, tileCountFor(GameType.WORDS)),
        gameType: GameType.WORDS,
        source: {type: WordSourceType.AI, prompt, pool},
      };
    } catch (_e) {
      console.error(
          'themed word generation failed; falling back to the default list');
      return await boardFromList(DEFAULT_WORD_LIST) ?? emergencyBoard();
    }
  }

  return await boardFromList(wordList || DEFAULT_WORD_LIST) ??
      await boardFromList(DEFAULT_WORD_LIST) ?? emergencyBoard();
}

/**
 * Deal from a /wordlists doc, built-in or player-made. Returns null when the
 * doc is missing or doesn't hold enough usable entries for a full board.
 */
async function boardFromList(listId: string): Promise<Board|null> {
  const snapshot = await db.collection('wordlists').doc(listId).get();
  const list = snapshot.data() as WordList | undefined;
  if (!list) {
    console.log(`word list "${listId}" does not exist`);
    return null;
  }

  const builtIn = !list.createdBy;
  // Player-made lists are only ever words or images; the asset-backed types
  // belong to the built-in docs.
  const gameType = builtIn ?
      (BUILT_IN_GAME_TYPES[listId] ?? GameType.WORDS) :
      (list.gameType === GameType.IMAGES ? GameType.IMAGES : GameType.WORDS);

  const count = tileCountFor(gameType);
  const words = shuffle(usableEntries(list.words, gameType)).slice(0, count);
  if (words.length < count) {
    console.log(`word list "${listId}" had only ${words.length} usable entries`);
    return null;
  }

  const source: GameWordSource = {
    type: builtIn ? WordSourceType.BUILT_IN : WordSourceType.SAVED,
    listId,
    listName: list.name || listId,
  };
  if (list.prompt) {
    source.prompt = list.prompt;
  }
  return {words, gameType, source};
}

function emergencyBoard(): Board {
  return {
    words: EMERGENCY_WORDS,
    gameType: GameType.WORDS,
    source: {type: WordSourceType.BUILT_IN, listName: 'Original'},
  };
}

/**
 * Trim, drop empties and dupes (there are some in the built-in lists), and
 * drop anything that can't safely go on a board. List docs are written by
 * players, so this is the check that counts — the client and the security
 * rules only do the coarse shape.
 */
function usableEntries(entries: unknown, gameType: GameType): string[] {
  if (!Array.isArray(entries)) return [];
  const isImages = gameType === GameType.IMAGES;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of entries) {
    if (typeof raw !== 'string') continue;
    const entry = raw.trim();
    const key = isImages ? entry : entry.toLowerCase();
    if (!entry || seen.has(key)) continue;
    if (isImages ? !isImageRef(entry) :
                   entry.length > WORD_LIST_LIMITS.wordLength) {
      continue;
    }
    seen.add(key);
    out.push(entry);
  }
  return out;
}

// An image tile is either an upload (`ctimg:<docId>`) or an https link.
function isImageRef(ref: string): boolean {
  if (ref.length > WORD_LIST_LIMITS.imageRefLength) return false;
  if (ref.startsWith(IMAGE_REF_PREFIX)) {
    return /^[A-Za-z0-9]+$/.test(ref.slice(IMAGE_REF_PREFIX.length));
  }
  return /^https:\/\/\S+$/.test(ref);
}

function dealTiles({words, gameType}: Board): Tile[] {
  const tiles: Tile[] = words.map(word => {
    const tile: Tile = {word, role: TileRole.CIVILIAN, selected: false};
    // `word` stays the tile's identity everywhere (guesses, clues); `image`
    // is what tells the client to render it as a picture.
    if (gameType === GameType.IMAGES) {
      tile.image = word;
    }
    return tile;
  });

  // get red, blue, and assassin counts
  // assign the roles then shuffle the tiles
  // each loop is bounded by tiles.length as defense-in-depth against a short
  // board (every path above normally yields a full one)
  const {red, blue, assassins} = getRoleCounts(gameType);
  for (let i = 0; i < red && i < tiles.length; i++) {
    tiles[i].role = TileRole.RED;
  }
  for (let i = red; i < red + blue && i < tiles.length; i++) {
    tiles[i].role = TileRole.BLUE;
  }
  for (let i = red + blue; i < red + blue + assassins && i < tiles.length; i++) {
    tiles[i].role = TileRole.ASSASSIN;
  }

  return shuffle(tiles);
}

async function getRoom(roomId: string): Promise<Room|undefined> {
  const roomSnapshot = await db.collection('rooms').doc(roomId).get();
  return roomSnapshot.data() as Room | undefined;
}

function getRoleCounts(gameType: GameType) {
  const random = Math.round(Math.random());
  if (isPictureGameType(gameType)) {
    return random ? {red: 7, blue: 8, assassins: 1} :
                    {red: 8, blue: 7, assassins: 1};
  } else {
    return random ? {red: 8, blue: 9, assassins: 1} :
                    {red: 9, blue: 8, assassins: 1};
  }
}
