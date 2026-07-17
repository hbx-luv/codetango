import {createHash} from 'crypto';
import * as admin from 'firebase-admin';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';

import {Game, GameStatus, GameType, Room, ThemedWordlist, Tile, TileRole, WordList} from '../types';
import {generateThemedWordPool} from '../util/chatgpt';
import {anthropicApiKey, chatgptApiKey} from '../util/llm';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

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


function getGameType(
    game: Game,
    wordList: string,
    aiWordlistTheme?: string,
    ): GameType {
  // if generating an AI word list, it'll always be words
  if (aiWordlistTheme) return GameType.WORDS;

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
        if (wordList === 'emoji-remix') {
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

          // Add 25 random cards to the game if there are no tiles
          // If the game is created with tiles already set, this game was
          // probably migrated. Do not modify any of the other fields
          if (!game.tiles) {
            const {wordList = 'original', aiWordlistTheme} =
                await getRoom(game.roomId);

            updates.hasPictures =
                (wordList === 'pictures' || wordList === 'memes');
            updates.hasEmojis =
                wordList === 'emojis' || wordList === 'emoji-remix';
            updates.gameType = getGameType(game, wordList, aiWordlistTheme);
            updates.tiles =
                await generateNewGameTiles(wordList, aiWordlistTheme);
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

async function generateNewGameTiles(
    wordList: string,
    aiWordlistTheme?: string,
    ): Promise<Tile[]> {
  let words: string[];
  if (aiWordlistTheme) {
    try {
      words = await getThemedWordsForGame(aiWordlistTheme);
    } catch (_e) {
      console.error(
          'themed word generation failed; falling back to original list');
      words = await getWords('original');
    }
  } else {
    words = await getWords(wordList);
  }

  const tiles = words.map(word => {
    return {
      word, role: TileRole.CIVILIAN, selected: false
    }
  });

  // get red, blue, and assassin counts
  // assign the roles then shuffle the tiles
  // each loop is bounded by tiles.length as defense-in-depth against a short
  // word list (the fallback normally yields a full 25-tile board)
  const {red, blue, assassins} = getRoleCounts(wordList);
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

// Resolve the 25 words for a themed board. Reuses a previously-generated pool
// for this theme when one exists (no AI call); otherwise generates a fresh full
// pool, persists it keyed by the normalized theme, and samples from it. Every
// reuse re-samples, so the same theme yields a different board each game.
// Propagates AllProvidersFailedError only when there's no saved pool AND
// generation fails — generateNewGameTiles catches it and falls back.
async function getThemedWordsForGame(theme: string): Promise<string[]> {
  const themeKey = theme.trim().toLowerCase();
  // Deterministic doc ID => idempotent writes: two concurrent first-time
  // generations for the same theme converge on one doc instead of duplicating.
  // (Raw theme text can't be a doc ID — it may contain '/', be empty, or exceed
  // Firestore's 1500-byte key limit.)
  const ref = db.collection('themedWordlists').doc(md5(themeKey));

  const snap = await ref.get();
  let pool = snap.exists ? (snap.data() as ThemedWordlist).words ?? [] : [];

  // No usable saved pool — generate a fresh one and persist it for next time.
  if (pool.length < 25) {
    pool = await generateThemedWordPool(theme);  // >= 25 words, or throws
    if (pool.length >= 25) {
      await ref.set(
          {theme, themeKey, words: pool, createdAt: new Date().getTime()});
      // The collection just grew — trim it back to the cap.
      await enforceThemeCap();
    }
  }

  return sampleWords(pool, 25);
}

// Keep the saved-theme collection from growing without bound: once it exceeds
// SAVED_THEME_CAP, delete the oldest *unpinned* lists until it's back at the
// cap. Pinned lists are never auto-deleted, so a heavily-pinned collection can
// legitimately sit above the cap. Runs only after a new list is saved.
const SAVED_THEME_CAP = 50;
async function enforceThemeCap(): Promise<void> {
  const col = db.collection('themedWordlists');
  const all = (await col.orderBy('createdAt', 'asc').get()).docs;
  const overflow = all.length - SAVED_THEME_CAP;
  if (overflow <= 0) return;

  const batch = db.batch();
  let removed = 0;
  for (const doc of all) {  // oldest first
    if (removed >= overflow) break;
    if (doc.get('pinned')) continue;  // protected
    batch.delete(doc.ref);
    removed++;
  }
  if (removed > 0) await batch.commit();
}

// Sample up to `count` unique, non-empty words from a pool without mutating it.
// Mirrors getWords' copy-splice dedupe loop and is bounded by pool length so a
// short pool terminates instead of spinning.
function sampleWords(pool: string[], count: number): string[] {
  const available = [...pool];
  const picked = [] as string[];
  while (picked.length < count && available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    const word = available.splice(randomIndex, 1)[0];
    if (word !== undefined && word !== '' && !picked.includes(word)) {
      picked.push(word);
    }
  }
  return picked;
}

async function getWords(wordList: string): Promise<string[]> {
  const snapshot = await db.collection('wordlists').doc(wordList).get();
  if (snapshot.exists && snapshot.data()) {
    console.log(`word list "${wordList}" exists`);
    const newWordsForGame = [] as string[];
    const {words = []} = snapshot.data() as WordList;
    // copy so we can splice without mutating the fetched doc data
    const available = [...words];

    const isPictures = (wordList === 'pictures' || wordList === 'memes');
    // in codenames pictures (and memes), you only get 20 tiles
    const count = isPictures ? 20 : 25;

    // Bound the loop on `available` so a short or empty doc terminates rather
    // than spinning forever pushing `undefined` (the previous latent hang).
    while (newWordsForGame.length < count && available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const word = available.splice(randomIndex, 1)[0];

      // ensure no dupes / empties (since there are some in the word list)
      if (word !== undefined && word !== '' &&
          !newWordsForGame.includes(word)) {
        newWordsForGame.push(word);
      }
    }

    if (newWordsForGame.length >= count) {
      console.log('newWordsForGame has ' + newWordsForGame.length + ' words.');
      return newWordsForGame;
    }

    // Doc existed but didn't hold enough usable words — fall through to the
    // hardcoded default rather than returning a too-short board.
    console.log(`word list "${wordList}" had only ${
        newWordsForGame.length} usable words; using hardcoded default`);
  } else {
    console.log('defaultWords did not exist')
  }

  const hardcodedfornow = [
    'AFRICA', 'AGENT',     'AIR',      'ALIEN',     'ALPS',
    'AMAZON', 'AMBULANCE', 'AMERICA',  'ANGEL',     'ANTARCTICA',
    'APPLE',  'ARM',       'ATLANTIS', 'AUSTRALIA', 'AZTEC',
    'BACK',   'BALL',      'BAND',     'BANK',      'BAR',
    'BARK',   'BAT',       'BATTERY',  'BEACH',     'BEAR'
  ];
  return hardcodedfornow;
}

async function getRoom(roomId: string): Promise<Room> {
  const roomSnapshot = await db.collection('rooms').doc(roomId).get();
  return (roomSnapshot.data() as Room);
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
