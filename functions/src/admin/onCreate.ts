import * as admin from 'firebase-admin';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}
const db = admin.firestore() as any;

import {CommitStep, RecalcJob, RecalcJobType, RecalcPhase} from '../types';
import {recalcElo} from '../util/elo';
import {
  commitStep,
  countCompletedGames,
  countGamesForUser,
  estimateCommitTotal,
  migrateGamesBatch,
} from '../util/staged-recalc';

const ADMIN = 'admin';
const ADMIN_JOBS = 'adminJobs';
const CURRENT_JOB = 'current';

const CONTINUE_ACTION = 'continue';
const RECALC_ACTION = 'recalc';                // live auto-chain from recalcElo
const START_MERGE_ACTION = 'startMerge';       // UI-triggered merge job
const START_RECALC_ACTION = 'startRecalc';     // UI-triggered recalc job
// Legacy: the old UI wrote admin/migrate; we keep this alias for compatibility
// with any in-flight command doc left over from a previous deploy.
const LEGACY_MIGRATE_ACTION = 'migrate';

export const onCreateAdmin =
    onDocumentCreated('admin/{action}', async (event) => {
      const cmd = event.data;
      if (!cmd) return;
      const action = event.params.action;
      const data = cmd.data() ?? {};

      console.log(`admin action: ${action}`);

      try {
        // Live self-chain from recalcElo — behavior preserved from the
        // legacy handler so onUpdateGame / onDeleteGame recalcs still work.
        if (action === RECALC_ACTION) {
          await recalcElo(db, data.timestamp ?? 0);
          await cmd.ref.delete();
          return;
        }

        if (action === START_MERGE_ACTION ||
            action === LEGACY_MIGRATE_ACTION) {
          await cmd.ref.delete();
          await startMergeJob(
              data.oldUserId ?? data.oldUser,
              data.newUserId ?? data.newUser,
              data.oldUserName,
              data.newUserName,
          );
          await triggerContinue();
          return;
        }

        if (action === START_RECALC_ACTION) {
          await cmd.ref.delete();
          await startRecalcJob();
          await triggerContinue();
          return;
        }

        if (action === CONTINUE_ACTION) {
          await cmd.ref.delete();
          await runNextStep();
          return;
        }

        // Unknown action — drop it so the doc doesn't linger.
        console.log(`unknown admin action: ${action}`);
        await cmd.ref.delete();
      } catch (err) {
        console.error(`admin action ${action} failed`, err);
        // Best-effort: mark the current job as errored so the UI can show it.
        await markJobError(err).catch((e) => console.error('markJobError', e));
      }
    });

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

async function startMergeJob(
    oldUserId: string,
    newUserId: string,
    oldUserName?: string,
    newUserName?: string,
    ): Promise<void> {
  if (!oldUserId || !newUserId) {
    console.log('startMerge: missing user ids, ignoring');
    return;
  }
  if (oldUserId === newUserId) {
    console.log('startMerge: old and new are the same, ignoring');
    return;
  }
  if (await isJobActive()) {
    console.log('startMerge: another job is already active, ignoring');
    return;
  }

  const now = Date.now();
  const [migrateCount, completedCount] = await Promise.all([
    countGamesForUser(db, oldUserId),
    countCompletedGames(db),
  ]);

  const job: RecalcJob = {
    jobId: newJobId(),
    type: RecalcJobType.MERGE,
    phase: RecalcPhase.MIGRATING,
    oldUserId,
    newUserId,
    ...(oldUserName ? {oldUserName} : {}),
    ...(newUserName ? {newUserName} : {}),
    totalGames: completedCount + migrateCount,
    processedGames: 0,
    migratedGames: 0,
    committedItems: 0,
    totalCommitItems: 0,
    startedAt: now,
    updatedAt: now,
    cursorTimestamp: 0,
  };

  await db.collection(ADMIN_JOBS).doc(CURRENT_JOB).set(job);
  console.log(`merge job started`, {jobId: job.jobId, oldUserId, newUserId});
}

async function startRecalcJob(): Promise<void> {
  if (await isJobActive()) {
    console.log('startRecalc: another job is already active, ignoring');
    return;
  }

  const now = Date.now();
  const completedCount = await countCompletedGames(db);

  const job: RecalcJob = {
    jobId: newJobId(),
    type: RecalcJobType.RECALC,
    phase: RecalcPhase.RECALCULATING,
    totalGames: completedCount,
    processedGames: 0,
    migratedGames: 0,
    committedItems: 0,
    totalCommitItems: 0,
    startedAt: now,
    updatedAt: now,
    cursorTimestamp: 0,
  };

  await db.collection(ADMIN_JOBS).doc(CURRENT_JOB).set(job);
  console.log(`recalc job started`, {jobId: job.jobId});
}

async function runNextStep(): Promise<void> {
  const job = await loadJob();
  if (!job) {
    console.log('runNextStep: no active job, ignoring');
    return;
  }
  if (job.phase === RecalcPhase.DONE || job.phase === RecalcPhase.ERROR) {
    console.log(`runNextStep: job already ${job.phase}, ignoring`);
    return;
  }

  try {
    if (job.phase === RecalcPhase.MIGRATING) {
      await stepMigrating(job);
    } else if (job.phase === RecalcPhase.RECALCULATING) {
      await stepRecalculating(job);
    } else if (job.phase === RecalcPhase.COMMITTING) {
      await stepCommitting(job);
    }
  } catch (err) {
    console.error(`step failed in phase ${job.phase}`, err);
    await markJobError(err);
  }
}

async function stepMigrating(job: RecalcJob): Promise<void> {
  const {oldUserId, newUserId, cursorTimestamp} = job;
  if (!oldUserId || !newUserId) {
    // shouldn't happen for MERGE jobs; move on so we don't stall
    await updateJob({
      phase: RecalcPhase.RECALCULATING,
      cursorTimestamp: 0,
      updatedAt: Date.now(),
    });
    await triggerContinue();
    return;
  }

  const result =
      await migrateGamesBatch(db, oldUserId, newUserId, cursorTimestamp);

  const patch: Partial<RecalcJob> = {
    migratedGames: (job.migratedGames ?? 0) + result.processed,
    cursorTimestamp: result.cursorTimestamp,
    updatedAt: Date.now(),
  };

  if (result.done) {
    patch.phase = RecalcPhase.RECALCULATING;
    patch.cursorTimestamp = 0;
  }

  await updateJob(patch);
  await triggerContinue();
}

async function stepRecalculating(job: RecalcJob): Promise<void> {
  const result = await recalcElo(db, job.cursorTimestamp, undefined, {
    staged: true,
  });

  const advanced = result.lastTimestamp > job.cursorTimestamp;
  const patch: Partial<RecalcJob> = {
    processedGames: (job.processedGames ?? 0) + result.processed,
    cursorTimestamp: result.lastTimestamp,
    updatedAt: Date.now(),
  };

  // Advance to COMMITTING when we're out of games. We treat "no new work" as
  // done, matching the live auto-chain's `lastTimestamp > timestamp` check.
  if (!advanced || result.processed === 0) {
    const totalCommitItems =
        await estimateCommitTotal(db, !!job.oldUserId, job.oldUserId);
    patch.phase = RecalcPhase.COMMITTING;
    patch.commitStep = CommitStep.USERS;
    patch.totalCommitItems = totalCommitItems;
    patch.committedItems = 0;
  }

  await updateJob(patch);
  await triggerContinue();
}

async function stepCommitting(job: RecalcJob): Promise<void> {
  const step = job.commitStep ?? CommitStep.USERS;
  const result = await commitStep(db, job, step);

  const patch: Partial<RecalcJob> = {
    committedItems: (job.committedItems ?? 0) + result.written,
    updatedAt: Date.now(),
  };

  if (result.done) {
    patch.phase = RecalcPhase.DONE;
    patch.finishedAt = Date.now();
  } else if (result.nextStep) {
    patch.commitStep = result.nextStep;
  }

  await updateJob(patch);

  if (!result.done) {
    await triggerContinue();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadJob(): Promise<RecalcJob|null> {
  const snap = await db.collection(ADMIN_JOBS).doc(CURRENT_JOB).get();
  return snap.exists ? snap.data() as RecalcJob : null;
}

async function updateJob(patch: Partial<RecalcJob>): Promise<void> {
  await db.collection(ADMIN_JOBS).doc(CURRENT_JOB).set(patch, {merge: true});
}

async function isJobActive(): Promise<boolean> {
  const job = await loadJob();
  if (!job) return false;
  return job.phase !== RecalcPhase.DONE && job.phase !== RecalcPhase.ERROR;
}

async function markJobError(err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await updateJob({
    phase: RecalcPhase.ERROR,
    error: message,
    finishedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// Firestore `onDocumentCreated` triggers require a create event. Delete any
// stale doc first so the following set() re-fires the trigger.
async function triggerContinue(): Promise<void> {
  const ref = db.collection(ADMIN).doc(CONTINUE_ACTION);
  await ref.delete().catch(() => {/* no-op if doesn't exist */});
  await ref.set({triggeredAt: Date.now()});
}

function newJobId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
