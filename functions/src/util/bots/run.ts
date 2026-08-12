import * as admin from 'firebase-admin';
import {FieldValue} from 'firebase-admin/firestore';

import {Clue, Game, GameStatus, Room, RoomStatus, Team, TeamType, Tile, TileRole} from '../../types';
import {AllProvidersFailedError, complete} from '../llm';

import {clueChatMessage, sendSpymasterMessage} from '../message';

import {computeGameStatus, currentTeam, guesserView, isGameOver, partitionBoard, teamObj} from './board';
import {buildCluePrompt, buildGuessPrompt, CLUE_SCHEMA, GUESS_SCHEMA, isClueResponse, isGuessResponse} from './prompts';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}
const db = admin.firestore();

// The lease is refreshed each drain iteration; if a run dies hard the lock
// frees itself after LEASE_MS. The drain loop stops at DRAIN_DEADLINE_MS
// (comfortably under the 300s function timeout) and re-triggers itself. Small
// pause before acting so humans can watch the board update and to space out
// chained bot moves.
const LEASE_MS = 90_000;
const DRAIN_DEADLINE_MS = 240_000;
const ACTION_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Bot ids are minted with a 'bot_' prefix in seat.ts, so identity is a cheap
// synchronous string check — no user-doc read on every game write.
function isBotId(id: string|undefined): boolean {
  return !!id && id.startsWith('bot_');
}

/** First non-spymaster member of the team that is a bot, if any. */
function botGuesserOf(team: Team): string|undefined {
  return (team.userIds || []).find(uid => uid !== team.spymaster && isBotId(uid));
}

function gameHasBot(game: Game): boolean {
  return [...(game.redTeam?.userIds || []), ...(game.blueTeam?.userIds || [])]
      .some(isBotId);
}

async function latestClue(gameId: string): Promise<Clue|null> {
  const snap = await db.collection('games').doc(gameId).collection('clues')
                   .orderBy('createdAt', 'desc').limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as Clue);
}
async function currentClueRef(gameId: string, team: TeamType) {
  // Latest clue overall, verified against the team in code. A where('team')
  // + orderBy('createdAt') query would need a composite index that prod
  // doesn't have (the emulator auto-creates indexes, so only prod fails).
  // maybeRunBot only enters the guess path when the newest clue belongs to
  // the acting team, so checking the latest doc is equivalent.
  const snap = await db.collection('games').doc(gameId).collection('clues')
                   .orderBy('createdAt', 'desc').limit(1).get();
  if (snap.empty) return null;
  const clue = snap.docs[0].data() as Clue;
  return (clue.team as unknown) === team ? snap.docs[0].ref : null;
}

/**
 * Acquire a short-lived per-game lease so overlapping trigger invocations don't
 * double-act. Stored under a subcollection with no triggers of its own.
 */
async function acquireLock(gameId: string): Promise<boolean> {
  const ref = db.collection('games').doc(gameId).collection('_bot').doc('lock');
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const until = snap.exists ? (snap.data()?.until as number) : 0;
      if (until && until > Date.now()) return false;
      tx.set(ref, {until: Date.now() + LEASE_MS});
      return true;
    });
  } catch (_e) {
    return false;
  }
}
async function releaseLock(gameId: string): Promise<void> {
  await db.collection('games').doc(gameId).collection('_bot').doc('lock')
      .set({until: 0});
}
async function refreshLock(gameId: string): Promise<void> {
  await db.collection('games').doc(gameId).collection('_bot').doc('lock')
      .set({until: Date.now() + LEASE_MS});
}

/**
 * The bot brain. Called from game/clue triggers. The invocation that wins the
 * lock DRAINS every pending bot action in a loop (clue -> guesses -> pass ->
 * next clue...), re-reading state each iteration, until no bot action is
 * needed. Invocations that lose the lock simply exit: their work is covered by
 * the holder's next loop iteration.
 *
 * This drain model exists because "one action per trigger" deadlocks: a bot's
 * own write re-triggers this function while the bot still holds the lock, the
 * new invocation bails, and no later trigger ever comes.
 */
export async function maybeRunBot(gameId: string): Promise<void> {
  const gameRef = db.collection('games').doc(gameId);
  const first = (await gameRef.get()).data() as Game | undefined;
  if (!first || !first.tiles?.length || isGameOver(first.status)) return;
  // Fast path: nothing to do unless a bot is actually in this game.
  if (!gameHasBot(first)) return;

  if (!(await acquireLock(gameId))) return;  // holder will drain our work
  const start = Date.now();
  let deadlineHit = false;
  try {
    for (;;) {
      if (Date.now() - start > DRAIN_DEADLINE_MS) {
        deadlineHit = true;
        break;
      }
      await refreshLock(gameId);

      const game = (await gameRef.get()).data() as Game | undefined;
      if (!game || isGameOver(game.status)) break;
      const team = currentTeam(game.status);
      if (!team) break;
      const tObj = teamObj(game, team);
      if (!tObj) break;

      const latest = await latestClue(gameId);
      const clueIsForThisTurn = !!latest && (latest.team as unknown) === team;

      let acted = false;
      if (!clueIsForThisTurn && isBotId(tObj.spymaster)) {
        await sleep(ACTION_DELAY_MS);
        acted = await doClue(gameId, game, team);
      } else if (
          clueIsForThisTurn && latest &&
          (latest.guessesMade || []).length < latest.maxGuesses) {
        const botId = botGuesserOf(tObj);
        if (botId) {
          await sleep(ACTION_DELAY_MS);
          acted = await doGuess(gameId, game, team, botId);
        }
      }
      if (!acted) break;  // no bot action needed (or action failed): stop
    }
  } finally {
    await releaseLock(gameId);
  }

  if (deadlineHit) {
    // There may be undone work whose triggers were dropped while we held the
    // lock. Nudge the game doc now that the lock is free: this update fires
    // onGameUpdateBot again and a fresh invocation continues the drain.
    await gameRef.update({botPing: Date.now()});
  }
}

/** Returns true if a clue was posted (i.e. the drain loop should continue). */
async function doClue(
    gameId: string, game: Game, team: TeamType): Promise<boolean> {
  const {playerWords, opponentWords, neutralWords, bombWord} =
      partitionBoard(game, team);
  if (!playerWords.length) return false;

  const cluesSnap =
      await db.collection('games').doc(gameId).collection('clues').get();
  const previous = cluesSnap.docs.map(d => d.data() as Clue)
                       .filter(c => (c.team as unknown) === team)
                       .map(c => c.word);

  const visible = (game.tiles || []).filter(t => !t.selected)
                      .map(t => (t.word || '').toUpperCase());
  const illegal = (word: string) => visible.some(
      w => w && (w === word || w.includes(word) || word.includes(w)));

  // Generate a clue, retrying a couple times if the model returns one that
  // collides with a board word. Retrying (rather than silently dropping) keeps
  // an all-bot game from stalling on a rare illegal clue.
  let word = '';
  let number = 1;
  let reason = '';
  let targetWords: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let clue;
    try {
      clue = await complete(
          {
            prompt: buildCluePrompt(
                playerWords, opponentWords, neutralWords, bombWord, previous),
            effort: 'high',
            thinking: {type: 'adaptive'},
            schema: CLUE_SCHEMA,
          },
          isClueResponse, ['anthropic']);
    } catch (e) {
      if (e instanceof AllProvidersFailedError) return false;  // skip, don't crash
      throw e;
    }
    const candidate = clue.hint.toUpperCase();
    if (!illegal(candidate)) {
      word = candidate;
      number = Math.max(1, clue.number);
      reason = clue.reason;
      targetWords = clue.targetWords ?? [];
      break;
    }
  }
  if (!word) return false;  // gave up after retries

  const guessCount = number > 9 ? '∞' : String(number);
  await db.collection('games').doc(gameId).collection('clues').add({
    word,
    guessCount,
    maxGuesses: number + 1,
    guessesMade: [],
    createdAt: Date.now(),
    team,
  });

  // Drop the bot's reasoning into the spymaster chat. Both spymasters already
  // see the whole board, and the chat (like the game doc holding tile roles) is
  // world-readable, so listing the target words leaks nothing a raw-DB reader
  // couldn't already get from the board itself.
  await sendSpymasterMessage(
      db, gameId,
      clueChatMessage(
          `The ${String(team).toLowerCase()} bot`, word, guessCount, reason,
          targetWords));
  return true;
}

/** Returns true if a guess or pass was written (drain loop continues). */
async function doGuess(
    gameId: string, game: Game, team: TeamType, botId: string):
    Promise<boolean> {
  const clueRef = await currentClueRef(gameId, team);
  if (!clueRef) return false;
  const clue = (await clueRef.get()).data() as Clue;
  const remaining = clue.maxGuesses - (clue.guessesMade || []).length;
  if (remaining <= 0) return false;

  const {unrevealed, revealed} = guesserView(game);

  let decision;
  try {
    decision = await complete(
        {
          prompt: buildGuessPrompt(
              clue.word, clue.guessCount, unrevealed, revealed,
              (clue.guessesMade || []).map(g => g.word || ''), remaining),
          effort: 'medium',
          schema: GUESS_SCHEMA,
        },
        isGuessResponse, ['anthropic', 'openai']);
  } catch (e) {
    if (e instanceof AllProvidersFailedError) {
      return await passTurn(gameId, game);  // degrade to a safe pass
    }
    throw e;
  }

  const room = await getRoom(game.roomId);
  const idx = decision.action === 'guess' && decision.word ?
      (game.tiles || []).findIndex(
          t => !t.selected &&
              (t.word || '').toUpperCase() === decision.word!.toUpperCase()) :
      -1;

  if (decision.action !== 'guess' || idx < 0) {
    return await passTurn(gameId, game, room);  // pass, or invalid word => pass
  }

  // --- reveal the tile (server replica of selectTile) ---
  const tiles = game.tiles!.map(t => ({...t}));
  tiles[idx].selected = true;
  tiles[idx].selectedBy = botId;
  const tile = tiles[idx] as Tile;

  let redAgents = game.redAgents;
  let blueAgents = game.blueAgents;
  if (tile.role === TileRole.BLUE) blueAgents = game.blueAgents - 1;
  else if (tile.role === TileRole.RED) redAgents = game.redAgents - 1;

  const status = computeGameStatus(game, tile, clue, redAgents, blueAgents);
  const updates: Partial<Game> = {tiles, redAgents, blueAgents, status};
  if (isGameOver(status)) updates.completedAt = Date.now();
  if (room?.timer && !updates.completedAt) {
    if (status === game.status) {
      if (game.turnEnds && room.guessIncrement) {
        updates.turnEnds = game.turnEnds + room.guessIncrement * 1000;
      }
    } else {
      updates.turnEnds = Date.now() + room.timer * 1000;
    }
  }

  await clueRef.update({
    guessesMade: FieldValue.arrayUnion(tile),
  });
  await db.collection('games').doc(gameId).update(updates);
  return true;
}

async function passTurn(gameId: string, game: Game, room?: Room|null):
    Promise<boolean> {
  const r = room ?? await getRoom(game.roomId);
  const updates: Partial<Game> = {
    status: game.status === GameStatus.REDS_TURN ? GameStatus.BLUES_TURN :
                                                   GameStatus.REDS_TURN,
  };
  if (r?.timer) updates.turnEnds = Date.now() + r.timer * 1000;
  await db.collection('games').doc(gameId).update(updates);
  return true;
}

async function getRoom(roomId: string): Promise<Room|null> {
  if (!roomId) return null;
  const snap = await db.collection('rooms').doc(roomId).get();
  return snap.exists ? (snap.data() as Room) : null;
}

/**
 * The pregame "start game" logic runs only on the RED spymaster's client. When
 * that seat is a bot, no client exists to start the game, so the server does it
 * once both teams are ready.
 */
export async function maybeStartGameForBots(roomId: string): Promise<void> {
  const roomRef = db.collection('rooms').doc(roomId);
  const room = (await roomRef.get()).data() as Room | undefined;
  if (!room || room.status !== RoomStatus.ASSIGNING_ROLES) return;
  if (!room.redReady || !room.blueReady) return;

  const gamesSnap = await db.collection('games').where('roomId', '==', roomId)
                        .orderBy('createdAt', 'desc').limit(1).get();
  if (gamesSnap.empty) return;
  const gameRef = gamesSnap.docs[0].ref;
  const game = gamesSnap.docs[0].data() as Game;

  // Only the server needs to start when the red spymaster is a bot; otherwise
  // the human red spymaster's client handles it (and resets the ready flags).
  if (!isBotId(game.redTeam?.spymaster)) return;
  if (!game.tiles?.length) return;

  const timer = room.firstTurnTimer || room.timer;
  const sortFirst = (t: Team) =>
      t.spymaster ? [t.spymaster, ...(t.userIds || []).filter(u => u !== t.spymaster)] :
                    (t.userIds || []);
  const updates: Partial<Game> = {
    blueTeam: {...game.blueTeam, userIds: sortFirst(game.blueTeam)},
    redTeam: {...game.redTeam, userIds: sortFirst(game.redTeam)},
  };
  if (timer) updates.turnEnds = Date.now() + timer * 1000;
  await gameRef.update(updates);
  await roomRef.update(
      {status: RoomStatus.GAME_IN_PROGRESS, redReady: false, blueReady: false});
}
