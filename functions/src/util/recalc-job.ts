import {FieldPath, FieldValue} from 'firebase-admin/firestore';

import {
  Clue,
  Game,
  MergePair,
  Message,
  RecalcJob,
  StatsSet,
  Tile,
  User,
} from '../types';

import {BigBatch} from './big-batch';
import {
  commitRecalc,
  createRecalcContext,
  processGame,
  statsToUserStats,
} from './elo';
import {collectionsFor, USER_STATS_STAGING} from './stats-sets';

// Per-invocation page sizes. Each step must finish comfortably inside the
// Cloud Function timeout, so these trade a few extra invocations for safety.
export const CLEAR_DOCS_PER_BATCH = 450;
export const MIGRATE_GAMES_PER_BATCH = 60;
export const SEED_DOCS_PER_BATCH = 450;
export const COMMIT_DOCS_PER_BATCH = 450;
// Queue-driven recalc: a game costs ~40 sequential queries, so cap both the
// count and the wall-clock per invocation.
export const WEB_GAMES_PER_BATCH = 40;
export const WEB_TIME_BUDGET_MS = 60_000;

export const ADMIN_JOBS = 'adminJobs';
export const CURRENT_JOB = 'current';
// adminJobs/current/queue/{gameId} — games waiting to be recalculated.
const QUEUE = 'queue';

// Subcollections under games/{id} that carry user ids.
const CLUES = 'clues';
const PROPOSED_CLUES = 'proposed-clues';
const SPYMASTER_CHAT = 'spymaster-chat';

export interface PageResult {
  // Documents written or deleted during this invocation.
  written: number;
  // True when this phase/step has no more work.
  done: boolean;
}

export interface QueueEntry {
  id: string;
  completedAt: number;
}

export function queueRef(db: any) {
  return db.collection(ADMIN_JOBS).doc(CURRENT_JOB).collection(QUEUE);
}

// ---------------------------------------------------------------------------
// Clearing: empty the build set (and scratch) so stale docs from an aborted
// job can never leak into a fresh recalc.
// ---------------------------------------------------------------------------

// Staging collections used by the previous (pre blue/green) recalc design.
// Nothing reads them anymore; they're swept at the start of every job so
// leftovers from an aborted run don't linger forever.
const LEGACY_STAGING = ['eloHistoryStaging', 'userToUserHistoryStaging'];

export function buildCollections(set: StatsSet): string[] {
  const {elo, u2u} = collectionsFor(set);
  return [elo, u2u, USER_STATS_STAGING, ...LEGACY_STAGING];
}

export async function countDocs(
    db: any, collections: string[]): Promise<number> {
  let total = 0;
  for (const name of collections) {
    const agg = await db.collection(name).count().get();
    total += agg.data().count as number;
  }
  return total;
}

/**
 * Delete up to `limit` docs across the given collection refs, in order.
 * Returns done once every collection comes back empty in the same
 * invocation.
 */
export async function deleteDocsPage(
    db: any, collections: any[], limit: number): Promise<PageResult> {
  const batch = new BigBatch(db);
  let remaining = limit;

  for (const coll of collections) {
    if (remaining <= 0) break;
    const ref = typeof coll === 'string' ? db.collection(coll) : coll;
    const snap = await ref.limit(remaining).get();
    for (const doc of snap.docs) batch.delete(doc.ref);
    remaining -= snap.size;
  }

  const written = limit - remaining;
  if (written > 0) await batch.commit();

  // Only call it done when a full sweep found nothing at all; a partially
  // filled page may have drained one collection while the next still has
  // docs we never queried.
  return {written, done: written === 0};
}

// ---------------------------------------------------------------------------
// Migrating: rewrite every user id reference in games (and their
// subcollections) for all merge pairs at once.
// ---------------------------------------------------------------------------

export interface MigrateBatchResult extends PageResult {
  // Games rewritten this invocation.
  processed: number;
  // Doc id of the last game handled, for the next page of the same pair.
  cursor?: string;
  // Completed games rewritten this invocation — the seeds of the recalc.
  completed: QueueEntry[];
}

export function idMapFor(pairs: MergePair[]): Map<string, string> {
  return new Map(pairs.map(p => [p.oldUserId, p.newUserId]));
}

/**
 * Count games that still reference oldUserId — the migrating-phase workload.
 */
export async function countGamesForUser(
    db: any, userId: string): Promise<number> {
  const agg = await db.collection('games')
                  .where('userIds', 'array-contains', userId)
                  .count()
                  .get();
  return agg.data().count as number;
}

/**
 * Rewrite one page of games that reference `oldUserId`, applying the full
 * id map so a game shared by two merged accounts is correct no matter which
 * pair visits it first. Pages are ordered by doc id so in-progress games
 * (no completedAt) are included too.
 */
export async function migrateGamesPage(
    db: any,
    oldUserId: string,
    idMap: Map<string, string>,
    cursor?: string,
    ): Promise<MigrateBatchResult> {
  let query = db.collection('games')
                  .where('userIds', 'array-contains', oldUserId)
                  .orderBy(FieldPath.documentId())
                  .limit(MIGRATE_GAMES_PER_BATCH);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();

  if (snapshot.empty) {
    return {written: 0, processed: 0, cursor, completed: [], done: true};
  }

  const batch = new BigBatch(db);
  const completed: QueueEntry[] = [];

  for (const doc of snapshot.docs) {
    const game = doc.data() as Game;
    batch.update(doc.ref, gameUpdates(game, idMap));

    // Clues, proposed clues and spymaster chat all carry user ids.
    for (const sub of [CLUES, PROPOSED_CLUES]) {
      const clues = await doc.ref.collection(sub).get();
      for (const clueDoc of clues.docs) {
        const clue = clueDoc.data() as Clue;
        const guesses = mapTiles(clue.guessesMade, idMap);
        if (guesses) batch.update(clueDoc.ref, {guessesMade: guesses});
      }
    }
    const chat = await doc.ref.collection(SPYMASTER_CHAT).get();
    for (const msgDoc of chat.docs) {
      const msg = msgDoc.data() as Message;
      const mapped = msg.userId ? idMap.get(msg.userId) : undefined;
      if (mapped) batch.update(msgDoc.ref, {userId: mapped});
    }

    if (game.completedAt) {
      completed.push({id: doc.id, completedAt: game.completedAt});
    }
  }

  await batch.commit();

  return {
    written: batch.size,
    processed: snapshot.size,
    cursor: snapshot.docs[snapshot.docs.length - 1].id,
    completed,
    done: snapshot.size < MIGRATE_GAMES_PER_BATCH,
  };
}

function gameUpdates(game: Game, idMap: Map<string, string>): any {
  const updates: any = {
    'userIds': mapIds(game.userIds ?? [], idMap),
    'redTeam.userIds': mapIds(game.redTeam?.userIds ?? [], idMap),
    'blueTeam.userIds': mapIds(game.blueTeam?.userIds ?? [], idMap),
  };
  const redSpy = game.redTeam?.spymaster;
  if (redSpy && idMap.has(redSpy)) {
    updates['redTeam.spymaster'] = idMap.get(redSpy);
  }
  const blueSpy = game.blueTeam?.spymaster;
  if (blueSpy && idMap.has(blueSpy)) {
    updates['blueTeam.spymaster'] = idMap.get(blueSpy);
  }
  const tiles = mapTiles(game.tiles, idMap);
  if (tiles) updates.tiles = tiles;
  return updates;
}

// Replace ids and drop duplicates, so merging an account into one that was
// already in the same game doesn't list the player twice.
function mapIds(ids: string[], idMap: Map<string, string>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const mapped = idMap.get(id) ?? id;
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

// Returns a rewritten copy only when at least one tile's selectedBy changed,
// so untouched arrays aren't rewritten.
function mapTiles(tiles: Tile[]|undefined, idMap: Map<string, string>):
    Tile[]|undefined {
  if (!tiles?.length) return undefined;
  let changed = false;
  const out = tiles.map(tile => {
    const mapped = tile.selectedBy ? idMap.get(tile.selectedBy) : undefined;
    if (!mapped) return tile;
    changed = true;
    return {...tile, selectedBy: mapped};
  });
  return changed ? out : undefined;
}

// ---------------------------------------------------------------------------
// Queue: the set of games still to recalculate, keyed by game id so a game
// reached through several players is only ever queued once.
// ---------------------------------------------------------------------------

export async function enqueueGames(db: any, entries: QueueEntry[]) {
  if (entries.length === 0) return;
  const batch = new BigBatch(db);
  for (const entry of entries) {
    batch.set(
        queueRef(db).doc(entry.id), {completedAt: entry.completedAt},
        {merge: true});
  }
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Seeding: copy the live set into the build set, minus the merged-away
// accounts' rows. Every game the recalc visits overwrites its own docs by
// id, so copying everything up front is what lets the recalc stop as soon as
// the queue runs dry instead of scanning to the present.
// ---------------------------------------------------------------------------

export interface SeedPageResult extends PageResult {
  cursorTimestamp?: number;
  cursorId?: string;
}

export async function countSeedDocs(
    db: any, liveSet: StatsSet): Promise<number> {
  const {elo, u2u} = collectionsFor(liveSet);
  return countDocs(db, [elo, u2u]);
}

export async function seedPage(
    db: any,
    liveSet: StatsSet,
    buildSet: StatsSet,
    collectionIndex: number,
    oldUserIds: Set<string>,
    cursorTimestamp?: number,
    cursorId?: string,
    ): Promise<SeedPageResult> {
  const from = Object.values(collectionsFor(liveSet))[collectionIndex];
  const to = Object.values(collectionsFor(buildSet))[collectionIndex];

  let query = db.collection(from)
                  .orderBy('timestamp')
                  .orderBy(FieldPath.documentId())
                  .limit(SEED_DOCS_PER_BATCH);
  if (cursorTimestamp !== undefined && cursorId) {
    query = query.startAfter(cursorTimestamp, cursorId);
  }
  const snapshot = await query.get();
  if (snapshot.empty) return {written: 0, done: true};

  const batch = new BigBatch(db);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Rows keyed by a merged-away account are never rebuilt (its games are
    // now the new account's), so they must not be carried over.
    if (oldUserIds.has(data.userId) || oldUserIds.has(data.myUserId) ||
        oldUserIds.has(data.theirUserId)) {
      continue;
    }
    batch.set(db.collection(to).doc(doc.id), data);
  }
  await batch.commit();

  const last = snapshot.docs[snapshot.docs.length - 1];
  return {
    written: snapshot.size,
    cursorTimestamp: last.data().timestamp,
    cursorId: last.id,
    done: snapshot.size < SEED_DOCS_PER_BATCH,
  };
}

// ---------------------------------------------------------------------------
// Queue-driven recalc: pop the earliest queued game, fold it in, then queue
// each of its players' next game. Only games downstream of a change are ever
// visited; everything else keeps its seeded copy.
// ---------------------------------------------------------------------------

export interface WebRecalcResult {
  processed: number;
  queueSize: number;
  lastTimestamp: number;
  done: boolean;
}

export async function countCompletedGamesFrom(
    db: any, from: number): Promise<number> {
  const agg = await db.collection('games')
                  .where('completedAt', '>=', from)
                  .count()
                  .get();
  return agg.data().count as number;
}

export async function webRecalcPage(
    db: any, job: RecalcJob): Promise<WebRecalcResult> {
  const queue = queueRef(db);
  const snapshot = await queue.orderBy('completedAt').get();
  if (snapshot.empty) {
    return {
      processed: 0,
      queueSize: 0,
      lastTimestamp: job.cursorTimestamp,
      done: true,
    };
  }

  // The whole frontier fits in memory: it holds at most one "next game"
  // per player who has been touched so far.
  const pending = new Map<string, number>();
  for (const doc of snapshot.docs) pending.set(doc.id, doc.data().completedAt);

  const ctx = createRecalcContext(db, job.buildSet);
  const queueBatch = new BigBatch(db);
  const deadline = Date.now() + WEB_TIME_BUDGET_MS;
  let processed = 0;
  let lastTimestamp = job.cursorTimestamp;

  while (pending.size > 0 && processed < WEB_GAMES_PER_BATCH &&
         Date.now() < deadline) {
    // Always take the earliest game: a game discovered through one player
    // can predate games already queued through another, and prior state
    // must be final before a game reads it.
    const next = popEarliest(pending);
    queueBatch.delete(queue.doc(next.id));
    processed++;

    const gameSnap = await db.collection('games').doc(next.id).get();
    if (!gameSnap.exists) continue;  // deleted since it was queued
    const game = {...gameSnap.data(), id: next.id} as Game;
    if (!game.completedAt) continue;

    await processGame(ctx, game);
    lastTimestamp = Math.max(lastTimestamp, game.completedAt);

    // Everyone in this game now has different stats going forward, so
    // each of their next games needs recalculating too.
    const players = game.blueTeam.userIds.concat(game.redTeam.userIds);
    const nexts = await Promise.all(
        players.map(p => nextGameFor(db, p, game.completedAt!, next.id)));
    for (const entry of nexts) {
      if (entry && !pending.has(entry.id)) {
        pending.set(entry.id, entry.completedAt);
        queueBatch.set(
            queue.doc(entry.id), {completedAt: entry.completedAt},
            {merge: true});
      }
    }
  }

  // History first, queue second: a crash in between re-runs these games
  // (idempotent) rather than skipping them.
  await commitRecalc(ctx, true);
  await queueBatch.commit();

  return {processed, queueSize: pending.size, lastTimestamp, done: false};
}

function popEarliest(pending: Map<string, number>): QueueEntry {
  let best: QueueEntry|undefined;
  for (const [id, completedAt] of pending) {
    if (!best || completedAt < best.completedAt) best = {id, completedAt};
  }
  pending.delete(best!.id);
  return best!;
}

// The next completed game this player appears in after `after`. Ties on
// completedAt are resolved by skipping the game we came from.
async function nextGameFor(
    db: any, userId: string, after: number,
    excludeId: string): Promise<QueueEntry|undefined> {
  const snap = await db.collection('games')
                   .where('userIds', 'array-contains', userId)
                   .where('completedAt', '>=', after)
                   .orderBy('completedAt', 'asc')
                   .limit(2)
                   .get();
  for (const doc of snap.docs) {
    if (doc.id !== excludeId) {
      return {id: doc.id, completedAt: doc.data().completedAt};
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Committing
// ---------------------------------------------------------------------------

export async function countCommitItems(
    db: any, job: RecalcJob): Promise<number> {
  const staged = await countDocs(db, [USER_STATS_STAGING]);
  // users step: staged users + 2 docs per merge pair + the pointer flip
  let total = staged + job.pairs.length * 2 + 1;
  if (job.flip) {
    const {elo, u2u} = collectionsFor(job.liveSet);
    total += await countDocs(db, [elo, u2u]);
  }
  // cleanup deletes the staged user docs again
  total += staged;
  return total;
}

/**
 * Last line of defence before the flip: a build set that is empty while the
 * live set isn't means something upstream silently did nothing, and
 * flipping would blank every chart.
 */
export async function assertBuildSetPopulated(db: any, job: RecalcJob) {
  const live = collectionsFor(job.liveSet);
  const build = collectionsFor(job.buildSet);
  const liveCount = await countDocs(db, [live.elo]);
  const buildCount = await countDocs(db, [build.elo]);
  if (liveCount > 0 && buildCount === 0) {
    throw new Error(
        `Refusing to flip: the ${job.buildSet} set is empty while ${
            job.liveSet} has ${liveCount} history docs.`);
  }
}

/**
 * Write every staged user's stats onto users/{id}, fold merged-away
 * accounts into their new ones, and flip the live pointer — all in one
 * BigBatch so the leaderboard, profiles and charts change together.
 */
export async function commitUsers(
    db: any, job: RecalcJob, systemRef: any): Promise<PageResult> {
  const staged = await db.collection(USER_STATS_STAGING).get();
  const batch = new BigBatch(db);

  // The pointer goes in the first (atomic) batch along with the first users.
  if (job.flip) {
    batch.set(systemRef, {
      liveSet: job.buildSet,
      flippedAt: Date.now(),
      jobId: job.jobId,
    });
  }

  // Load the users touched by merges once so the rooms union is computed
  // from their current docs.
  const pairUsers = new Map<string, User|undefined>();
  for (const pair of job.pairs) {
    for (const id of [pair.oldUserId, pair.newUserId]) {
      if (!pairUsers.has(id)) {
        const snap = await db.collection('users').doc(id).get();
        pairUsers.set(id, snap.exists ? snap.data() as User : undefined);
      }
    }
  }

  const oldIds = new Set(job.pairs.map(p => p.oldUserId));
  const existing = new Set<string>();
  const userDocs = await db.collection('users')
                       .select()  // ids only
                       .get();
  for (const doc of userDocs.docs) existing.add(doc.id);

  const buildElo = collectionsFor(job.buildSet).elo;
  for (const doc of staged.docs) {
    const {userId} = doc.data();
    if (!userId || oldIds.has(userId) || !existing.has(userId)) continue;

    // Final stats = the user's latest record in the build set, whether the
    // job recomputed it or carried it over from the copy.
    const latest = await db.collection(buildElo)
                       .where('userId', '==', userId)
                       .orderBy('timestamp', 'desc')
                       .limit(1)
                       .get();
    if (latest.empty) continue;
    const stats = statsToUserStats(latest.docs[0].data());
    batch.set(db.collection('users').doc(userId), {stats}, {merge: true});
  }

  for (const pair of job.pairs) {
    const oldUser = pairUsers.get(pair.oldUserId);
    const newUser = pairUsers.get(pair.newUserId);

    if (newUser) {
      // The leaderboard lists users by room membership, so the new account
      // must inherit every room the old one played in.
      const rooms = [...(newUser.rooms ?? [])];
      for (const room of oldUser?.rooms ?? []) {
        if (!rooms.includes(room)) rooms.push(room);
      }
      batch.set(
          db.collection('users').doc(pair.newUserId), {rooms}, {merge: true});
    }

    if (oldUser) {
      // Keep the doc (the old login may still exist) but take it off every
      // leaderboard and record where its history went.
      batch.set(
          db.collection('users').doc(pair.oldUserId),
          {
            stats: FieldValue.delete(),
            rooms: [],
            mergedInto: pair.newUserId,
            mergedAt: Date.now(),
          },
          {merge: true},
      );
    }
  }

  const written = batch.size;
  if (written > 0) await batch.commit();
  return {written, done: true};
}
