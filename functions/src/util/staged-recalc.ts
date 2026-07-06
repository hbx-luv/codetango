import {firestore} from 'firebase-admin';

import {CommitStep, Game, RecalcJob} from '../types';

import {BigBatch, MAX_BATCH_SIZE} from './big-batch';
import {
  ELO_HISTORY,
  ELO_HISTORY_STAGING,
  USER_STATS_STAGING,
  USER_TO_USER_HISTORY,
  USER_TO_USER_HISTORY_STAGING,
} from './elo';

// How many games to rewrite per migrating-phase invocation. The migrating
// phase only rewrites team/spymaster fields on games (small updates), so we
// can safely do more per invocation than the recalculating phase.
export const MIGRATE_GAMES_PER_BATCH = 300;

// How many documents to copy/delete per commit-phase invocation. Chosen so
// each step stays well under the Cloud Function timeout even at the top of
// the write-rate budget.
export const COMMIT_DOCS_PER_BATCH = 400;

// ---------------------------------------------------------------------------
// Migrating phase
// ---------------------------------------------------------------------------

export interface MigrateBatchResult {
  processed: number;
  cursorTimestamp: number;
  done: boolean;
}

/**
 * Rewrites one page of games that still reference `oldUser`. Advances the
 * cursor by the completedAt of the last rewritten game so the runner can
 * continue in a subsequent invocation.
 *
 * Only game roster fields are touched here — no history, no stats. Those
 * are handled by the subsequent recalculating and committing phases.
 */
export async function migrateGamesBatch(
    db: any,
    oldUser: string,
    newUser: string,
    cursorTimestamp: number,
    ): Promise<MigrateBatchResult> {
  const snapshot = await db.collection('games')
                       .where('userIds', 'array-contains', oldUser)
                       .where('completedAt', '>=', cursorTimestamp)
                       .orderBy('completedAt', 'asc')
                       .limit(MIGRATE_GAMES_PER_BATCH)
                       .get();

  if (snapshot.empty) {
    return {processed: 0, cursorTimestamp, done: true};
  }

  const batch = new BigBatch(db);
  let lastCompletedAt = cursorTimestamp;

  for (const doc of snapshot.docs) {
    const game = doc.data() as Game;

    const updates: firestore.UpdateData<any> = {
      'userIds': replaceInArray(game.userIds ?? [], oldUser, newUser),
      'redTeam.userIds':
          replaceInArray(game.redTeam.userIds, oldUser, newUser),
      'blueTeam.userIds':
          replaceInArray(game.blueTeam.userIds, oldUser, newUser),
    };
    if (game.redTeam.spymaster === oldUser) {
      updates['redTeam.spymaster'] = newUser;
    }
    if (game.blueTeam.spymaster === oldUser) {
      updates['blueTeam.spymaster'] = newUser;
    }

    batch.update(doc.ref, updates);
    lastCompletedAt = game.completedAt ?? lastCompletedAt;
  }

  await batch.commit();

  // If we filled the batch, there may be more games at the same or later
  // timestamps. Advance cursor by one ms so the next query skips games we
  // already handled (games can share a completedAt within the same ms).
  const done = snapshot.size < MIGRATE_GAMES_PER_BATCH;
  return {
    processed: snapshot.size,
    cursorTimestamp: done ? lastCompletedAt : lastCompletedAt + 1,
    done,
  };
}

/**
 * Count all completed games — used at the start of a job so the UI can render
 * a real progress bar during the recalculating phase.
 */
export async function countCompletedGames(db: any): Promise<number> {
  const agg = await db.collection('games')
                  .where('completedAt', '>=', 0)
                  .count()
                  .get();
  return agg.data().count as number;
}

/**
 * Count games that still reference oldUser — used at the start of a merge so
 * the UI knows the migrating-phase workload.
 */
export async function countGamesForUser(
    db: any, userId: string): Promise<number> {
  const agg = await db.collection('games')
                  .where('userIds', 'array-contains', userId)
                  .count()
                  .get();
  return agg.data().count as number;
}

// ---------------------------------------------------------------------------
// Committing phase
// ---------------------------------------------------------------------------

export interface CommitStepResult {
  // Number of documents written or deleted during this invocation.
  written: number;
  // The step the runner should execute next (may equal input step if there
  // is more work in this step; may be undefined once the phase is done).
  nextStep?: CommitStep;
  // True once all commit steps are complete.
  done: boolean;
}

/**
 * Advance the commit state machine by one page of work.
 *
 * Order (chosen so live data becomes correct as fast as possible):
 *   1. USERS               — flip live users.stats first so the leaderboard
 *                            snaps back to the new truth immediately.
 *   2. NUKE_OLD_USER       — merge-only; drop stale history for oldUser.
 *   3. COPY_ELO_HISTORY    — overwrite live eloHistory from staging.
 *   4. COPY_USER_TO_USER   — overwrite live userToUserHistory from staging.
 *   5. CLEANUP_STAGING     — drop all staging docs.
 */
export async function commitStep(
    db: any, job: RecalcJob, step: CommitStep): Promise<CommitStepResult> {
  switch (step) {
    case CommitStep.USERS:
      return commitUsersStep(db, job);
    case CommitStep.NUKE_OLD_USER:
      return nukeOldUserStep(db, job);
    case CommitStep.COPY_ELO_HISTORY:
      return copyStagingStep(
          db,
          ELO_HISTORY_STAGING,
          ELO_HISTORY,
          CommitStep.COPY_ELO_HISTORY,
          CommitStep.COPY_USER_TO_USER,
      );
    case CommitStep.COPY_USER_TO_USER:
      return copyStagingStep(
          db,
          USER_TO_USER_HISTORY_STAGING,
          USER_TO_USER_HISTORY,
          CommitStep.COPY_USER_TO_USER,
          CommitStep.CLEANUP_STAGING,
      );
    case CommitStep.CLEANUP_STAGING:
      return cleanupStagingStep(db);
    default:
      return {written: 0, done: true};
  }
}

async function commitUsersStep(
    db: any, job: RecalcJob): Promise<CommitStepResult> {
  const snapshot = await db.collection(USER_STATS_STAGING).get();

  const batch = new BigBatch(db);
  let written = 0;
  const stagedUserIds = new Set<string>();

  for (const doc of snapshot.docs) {
    const {userId, stats} = doc.data();
    if (!userId || !stats) continue;
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      batch.set(userRef, {stats}, {merge: true});
      written++;
      stagedUserIds.add(userId);
    }
  }

  // Users who exist in live but weren't touched by the recalc (e.g. the
  // merged-away oldUser, or a user whose games were all deleted) should
  // have their stats cleared. This handles both the normal case and the
  // corner case where staging is empty (e.g. old user had no games).
  if (job.oldUserId && !stagedUserIds.has(job.oldUserId)) {
    const oldRef = db.collection('users').doc(job.oldUserId);
    const oldSnap = await oldRef.get();
    if (oldSnap.exists) {
      batch.set(oldRef, {stats: null}, {merge: true});
      written++;
    }
  }

  if (written > 0) {
    await batch.commit();
  }

  return {
    written,
    nextStep: job.oldUserId ? CommitStep.NUKE_OLD_USER :
                              CommitStep.COPY_ELO_HISTORY,
    done: false,
  };
}

async function nukeOldUserStep(
    db: any, job: RecalcJob): Promise<CommitStepResult> {
  const oldUser = job.oldUserId!;
  let written = 0;

  // Live eloHistory rows keyed by the merged-away user.
  const eloSnap = await db.collection(ELO_HISTORY)
                      .where('userId', '==', oldUser)
                      .limit(COMMIT_DOCS_PER_BATCH)
                      .get();

  // Live userToUserHistory rows where oldUser is on either side of the pair.
  // Fetch enough to fill this invocation once eloHistory rows run out.
  const remaining = COMMIT_DOCS_PER_BATCH - eloSnap.size;
  const myU2u = remaining > 0 ?
      await db.collection(USER_TO_USER_HISTORY)
          .where('myUserId', '==', oldUser)
          .limit(remaining)
          .get() :
      {size: 0, docs: []};
  const remaining2 = remaining - myU2u.size;
  const theirU2u = remaining2 > 0 ?
      await db.collection(USER_TO_USER_HISTORY)
          .where('theirUserId', '==', oldUser)
          .limit(remaining2)
          .get() :
      {size: 0, docs: []};

  const total = eloSnap.size + myU2u.size + theirU2u.size;
  if (total === 0) {
    return {written: 0, nextStep: CommitStep.COPY_ELO_HISTORY, done: false};
  }

  const batch = new BigBatch(db);
  for (const doc of eloSnap.docs) batch.delete(doc.ref);
  for (const doc of myU2u.docs) batch.delete(doc.ref);
  for (const doc of theirU2u.docs) batch.delete(doc.ref);
  await batch.commit();
  written = total;

  // If we filled the page there may be more rows to nuke; stay on this step.
  const done = total < COMMIT_DOCS_PER_BATCH;
  return {
    written,
    nextStep: done ? CommitStep.COPY_ELO_HISTORY : CommitStep.NUKE_OLD_USER,
    done: false,
  };
}

/**
 * Copy one page of documents from a staging collection onto the live
 * collection, preserving doc IDs. When no more staged docs remain, advance
 * to `nextStep`.
 *
 * We delete the staged doc after copying so subsequent calls make progress
 * against the same query. The staging collection is then guaranteed empty
 * by the CLEANUP_STAGING step, but incremental deletion here also caps peak
 * storage during the commit phase.
 */
async function copyStagingStep(
    db: any,
    stagingCollection: string,
    liveCollection: string,
    thisStep: CommitStep,
    nextStep: CommitStep,
    ): Promise<CommitStepResult> {
  const snapshot =
      await db.collection(stagingCollection).limit(COMMIT_DOCS_PER_BATCH).get();

  if (snapshot.empty) {
    return {written: 0, nextStep, done: false};
  }

  const batch = new BigBatch(db);
  for (const doc of snapshot.docs) {
    batch.set(db.collection(liveCollection).doc(doc.id), doc.data());
    batch.delete(doc.ref);
  }
  await batch.commit();

  const done = snapshot.size < COMMIT_DOCS_PER_BATCH;
  return {
    written: snapshot.size,
    nextStep: done ? nextStep : thisStep,
    done: false,
  };
}

async function cleanupStagingStep(db: any): Promise<CommitStepResult> {
  // Sweep any lingering docs across all three staging collections. copyStagingStep
  // already deletes as it copies, so this is defensive against interruption.
  const collections =
      [ELO_HISTORY_STAGING, USER_TO_USER_HISTORY_STAGING, USER_STATS_STAGING];

  let written = 0;
  const batch = new BigBatch(db);
  let capacity = MAX_BATCH_SIZE * 2;  // stay well below COMMIT_DOCS_PER_BATCH*n

  for (const coll of collections) {
    if (capacity <= 0) break;
    const snap = await db.collection(coll).limit(capacity).get();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      written++;
      capacity--;
    }
  }

  if (written === 0) {
    return {written: 0, done: true};
  }

  await batch.commit();

  // Might still have more to clean up (e.g. large userStatsStaging); stay on
  // this step so the runner reinvokes us.
  return {written, nextStep: CommitStep.CLEANUP_STAGING, done: false};
}

/**
 * Estimate the total number of documents the commit phase will touch. Used
 * so the UI can show a stable "committed / total" ratio during commit.
 */
export async function estimateCommitTotal(
    db: any, hasOldUser: boolean, oldUserId?: string): Promise<number> {
  const userStatsCount =
      (await db.collection(USER_STATS_STAGING).count().get()).data().count as
      number;
  const eloCount =
      (await db.collection(ELO_HISTORY_STAGING).count().get()).data().count as
      number;
  const u2uCount = (await db.collection(USER_TO_USER_HISTORY_STAGING)
                        .count()
                        .get())
                       .data()
                       .count as number;

  let oldUserRows = 0;
  if (hasOldUser && oldUserId) {
    oldUserRows +=
        (await db.collection(ELO_HISTORY)
             .where('userId', '==', oldUserId)
             .count()
             .get())
            .data()
            .count as number;
    oldUserRows +=
        (await db.collection(USER_TO_USER_HISTORY)
             .where('myUserId', '==', oldUserId)
             .count()
             .get())
            .data()
            .count as number;
    oldUserRows +=
        (await db.collection(USER_TO_USER_HISTORY)
             .where('theirUserId', '==', oldUserId)
             .count()
             .get())
            .data()
            .count as number;
  }

  // userStats commit writes ~userStatsCount + (1 for oldUser null); nuke phase
  // writes oldUserRows; copy phases write eloCount + u2uCount; cleanup writes 0
  // net (docs were deleted during copy, so this is defensive only).
  return userStatsCount + oldUserRows + eloCount + u2uCount + 1;
}

function replaceInArray(array: any[], a: string, b: string): any[] {
  const copy = array.slice();
  for (let i = 0; i < copy.length; i++) {
    if (copy[i] === a) copy[i] = b;
  }
  return copy;
}
