import * as admin from 'firebase-admin';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}
const db = admin.firestore() as any;

import {
  CommitStep,
  MergePair,
  otherStatsSet,
  RecalcJob,
  RecalcJobType,
  RecalcMode,
  RecalcPhase,
} from '../types';
import {recalcElo} from '../util/elo';
import {
  ADMIN_JOBS,
  assertBuildSetPopulated,
  buildCollections,
  CLEAR_DOCS_PER_BATCH,
  COMMIT_DOCS_PER_BATCH,
  commitUsers,
  countCommitItems,
  countCompletedGamesFrom,
  countDocs,
  countGamesForUser,
  countSeedDocs,
  CURRENT_JOB,
  deleteDocsPage,
  enqueueGames,
  idMapFor,
  migrateGamesPage,
  queueRef,
  seedPage,
  webRecalcPage,
} from '../util/recalc-job';
import {
  collectionsFor,
  getLiveSet,
  STATS_CONFIG_DOC,
  SYSTEM,
  USER_STATS_STAGING,
} from '../util/stats-sets';

const ADMIN = 'admin';

const CONTINUE_ACTION = 'continue';
const RECALC_ACTION = 'recalc';             // live auto-chain from recalcElo
const START_MERGE_ACTION = 'startMerge';    // UI-triggered merge job
const START_RECALC_ACTION = 'startRecalc';  // UI-triggered recalc job
const CANCEL_ACTION = 'cancel';             // UI-triggered abort

/**
 * Every admin command is a doc created under /admin. The job itself advances
 * one page of work per invocation and re-triggers itself by recreating
 * admin/continue, so no single invocation runs anywhere near the timeout.
 */
export const onCreateAdmin = onDocumentCreated(
    {document: 'admin/{action}', timeoutSeconds: 300, memory: '512MiB'},
    async (event) => {
      const cmd = event.data;
      // The emulator can emit a create event with no snapshot (e.g. for a
      // delete of a doc that didn't exist). There's nothing to act on and
      // nothing to delete — touching the ref again would just re-fire it.
      if (!cmd?.exists) {
        console.log('admin: event without a document, ignoring');
        return;
      }
      const action = event.params.action;
      const data = cmd.data() ?? {};

      console.log(`admin action: ${action}`);

      try {
        // Live self-chain from recalcElo (game completion / deletion).
        // Delete the command *before* running: recalcElo re-creates this
        // same doc to schedule the next page, and deleting afterwards would
        // wipe that fresh command out from under its own trigger.
        if (action === RECALC_ACTION) {
          await cmd.ref.delete();
          if (typeof data.timestamp !== 'number') {
            // A mangled/duplicate event. Never fall back to 0 here — that
            // would be a full live recalc that rewrites every record.
            console.log('recalc: missing timestamp, ignoring', data);
            return;
          }
          // A chained page must start strictly after the page that scheduled
          // it. Anything else would be revisiting history — the one shape
          // an infinite loop can take, since the set of games is finite.
          if (typeof data.chainedFrom === 'number' &&
              data.timestamp <= data.chainedFrom) {
            console.error(
                'recalc: chained page does not advance, refusing', data);
            return;
          }
          await recalcElo(db, data.timestamp, undefined, {hops: data.hops});
          return;
        }

        if (action === START_MERGE_ACTION) {
          await cmd.ref.delete();
          await startJob(RecalcJobType.MERGE, parsePairs(data));
          return;
        }

        if (action === START_RECALC_ACTION) {
          await cmd.ref.delete();
          await startJob(RecalcJobType.RECALC, []);
          return;
        }

        if (action === CONTINUE_ACTION) {
          await cmd.ref.delete();
          if (typeof data.seq !== 'number') {
            console.log('continue: missing seq, ignoring', data);
            return;
          }
          await runNextStep(data.seq);
          return;
        }

        if (action === CANCEL_ACTION) {
          await cmd.ref.delete();
          await cancelJob();
          return;
        }

        // Unknown action — drop it so the doc doesn't linger.
        console.log(`unknown admin action: ${action}`);
        await cmd.ref.delete();
      } catch (err) {
        console.error(`admin action ${action} failed`, err);
        await markJobError(err).catch((e) => console.error('markJobError', e));
      }
    });

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

function parsePairs(data: any): MergePair[] {
  const raw: any[] = Array.isArray(data.pairs) ? data.pairs : [];
  const pairs: MergePair[] = [];
  for (const p of raw) {
    if (!p?.oldUserId || !p?.newUserId || p.oldUserId === p.newUserId) {
      continue;
    }
    pairs.push({
      oldUserId: p.oldUserId,
      newUserId: p.newUserId,
      ...(p.oldUserName ? {oldUserName: p.oldUserName} : {}),
      ...(p.newUserName ? {newUserName: p.newUserName} : {}),
    });
  }
  return pairs;
}

async function startJob(type: RecalcJobType, pairs: MergePair[]) {
  if (type === RecalcJobType.MERGE && pairs.length === 0) {
    console.log('startMerge: no valid pairs, ignoring');
    return;
  }

  // Reject chains (A→B and B→C) and double-merges (A→B and A→C): the
  // single-pass id map can't express them.
  const olds = new Set(pairs.map(p => p.oldUserId));
  if (olds.size !== pairs.length ||
      pairs.some(p => olds.has(p.newUserId))) {
    console.log('startMerge: pairs overlap, ignoring');
    return;
  }

  const liveSet = await getLiveSet(db);
  const buildSet = otherStatsSet(liveSet);
  const now = Date.now();

  let totalMigrateGames = 0;
  for (const pair of pairs) {
    totalMigrateGames += await countGamesForUser(db, pair.oldUserId);
  }
  const totalClearDocs = await countDocs(db, buildCollections(buildSet));

  const job: RecalcJob = {
    jobId: newJobId(),
    type,
    phase: RecalcPhase.CLEARING,
    seq: 0,
    pairs,
    liveSet,
    buildSet,
    recalcMode: pairs.length > 0 ? RecalcMode.WEB : RecalcMode.FULL,
    recalcFrom: 0,
    flip: true,
    clearedDocs: 0,
    totalClearDocs,
    migratedGames: 0,
    totalMigrateGames,
    migratePairIndex: 0,
    seededDocs: 0,
    totalSeedDocs: 0,
    seedCollectionIndex: 0,
    processedGames: 0,
    totalGames: 0,
    queueSize: 0,
    cursorTimestamp: 0,
    committedItems: 0,
    totalCommitItems: 0,
    startedAt: now,
    updatedAt: now,
    phaseStartedAt: now,
  };

  // Claim the job slot atomically so two admins can't start jobs at once.
  const jobRef = db.collection(ADMIN_JOBS).doc(CURRENT_JOB);
  const started = await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(jobRef);
    if (snap.exists && isActive(snap.data() as RecalcJob)) return false;
    tx.set(jobRef, job);
    return true;
  });

  if (!started) {
    console.log('startJob: another job is already active, ignoring');
    return;
  }

  console.log(`${type} job started`, {jobId: job.jobId, liveSet, buildSet});
  await triggerContinue(0);
}

/**
 * Claim and run one step. The claim bumps `seq` in a transaction, so a
 * duplicate delivery of the same continue doc (or a stale "resume" from the
 * UI) finds a mismatched seq and does nothing.
 */
async function runNextStep(expectedSeq: number) {
  const jobRef = db.collection(ADMIN_JOBS).doc(CURRENT_JOB);
  const job: RecalcJob|null = await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) return null;
    const current = snap.data() as RecalcJob;
    if (!isActive(current)) return null;
    if (current.seq !== expectedSeq) {
      console.log(`stale continue: expected ${expectedSeq}, job at ${
          current.seq}`);
      return null;
    }
    tx.update(jobRef, {seq: current.seq + 1});
    return {...current, seq: current.seq + 1};
  });

  if (!job) return;

  try {
    switch (job.phase) {
      case RecalcPhase.CLEARING:
        await stepClearing(job);
        break;
      case RecalcPhase.MIGRATING:
        await stepMigrating(job);
        break;
      case RecalcPhase.SEEDING:
        await stepSeeding(job);
        break;
      case RecalcPhase.RECALCULATING:
        await stepRecalculating(job);
        break;
      case RecalcPhase.COMMITTING:
        await stepCommitting(job);
        break;
    }
  } catch (err) {
    console.error(`step failed in phase ${job.phase}`, err);
    await markJobError(err);
  }
}

// Wipe the build set (and scratch, and any stale queue) before writing
// anything into it.
async function stepClearing(job: RecalcJob) {
  const result = await deleteDocsPage(
      db, [...buildCollections(job.buildSet), queueRef(db)],
      CLEAR_DOCS_PER_BATCH);

  const patch: Partial<RecalcJob> = {
    clearedDocs: job.clearedDocs + result.written,
  };

  if (result.done) {
    if (job.pairs.length > 0) {
      enterPhase(patch, RecalcPhase.MIGRATING);
    } else {
      // Plain recalc rebuilds everything, so there's nothing to seed.
      patch.recalcFrom = 0;
      patch.totalGames = await countCompletedGamesFrom(db, 0);
      enterPhase(patch, RecalcPhase.RECALCULATING);
    }
  }

  await updateJob(patch);
  await triggerContinue(job.seq);
}

// Rewrite games pair by pair. Every completed game rewritten is queued as a
// starting point for the recalc, and the earliest is remembered for the UI.
async function stepMigrating(job: RecalcJob) {
  const pair = job.pairs[job.migratePairIndex];
  const patch: Partial<RecalcJob> = {};

  if (!pair) {
    await finishMigrating(job, patch);
    await updateJob(patch);
    await triggerContinue(job.seq);
    return;
  }

  const result = await migrateGamesPage(
      db, pair.oldUserId, idMapFor(job.pairs), job.migrateCursor);
  await enqueueGames(db, result.completed);

  patch.migratedGames = job.migratedGames + result.processed;
  patch.queueSize = (job.queueSize ?? 0) + result.completed.length;
  for (const entry of result.completed) {
    // recalcFrom doubles as "earliest affected game"; 0 = nothing yet.
    const current = patch.recalcFrom ?? job.recalcFrom;
    patch.recalcFrom = current > 0 ? Math.min(current, entry.completedAt) :
                                     entry.completedAt;
  }

  if (result.done) {
    const nextIndex = job.migratePairIndex + 1;
    patch.migratePairIndex = nextIndex;
    patch.migrateCursor = '';
    if (nextIndex >= job.pairs.length) {
      await finishMigrating({...job, ...patch} as RecalcJob, patch);
    }
  } else {
    patch.migrateCursor = result.cursor ?? '';
  }

  await updateJob(patch);
  await triggerContinue(job.seq);
}

async function finishMigrating(job: RecalcJob, patch: Partial<RecalcJob>) {
  if (job.recalcFrom <= 0) {
    // No completed games changed hands, so the live history is already
    // right. Skip straight to the users step (rooms + stats cleanup) and
    // leave the live set alone.
    patch.flip = false;
    patch.totalCommitItems = await countCommitItems(
        db, {...job, flip: false});
    patch.commitStep = CommitStep.USERS;
    enterPhase(patch, RecalcPhase.COMMITTING);
    return;
  }

  patch.totalSeedDocs = await countSeedDocs(db, job.liveSet);
  // Upper bound for the progress bar; the queue usually stops well short.
  patch.totalGames = await countCompletedGamesFrom(db, job.recalcFrom);
  patch.seedCollectionIndex = 0;
  enterPhase(patch, RecalcPhase.SEEDING);
}

// Copy the live history into the build set, minus the merged-away accounts.
async function stepSeeding(job: RecalcJob) {
  const result = await seedPage(
      db,
      job.liveSet,
      job.buildSet,
      job.seedCollectionIndex,
      new Set(job.pairs.map(p => p.oldUserId)),
      job.seedCursorTimestamp,
      job.seedCursorId,
  );

  const patch: Partial<RecalcJob> = {
    seededDocs: job.seededDocs + result.written,
  };

  if (result.done) {
    const nextIndex = job.seedCollectionIndex + 1;
    patch.seedCollectionIndex = nextIndex;
    patch.seedCursorTimestamp = 0;
    patch.seedCursorId = '';
    if (nextIndex >= 2) {
      patch.cursorTimestamp = 0;
      enterPhase(patch, RecalcPhase.RECALCULATING);
    }
  } else {
    patch.seedCursorTimestamp = result.cursorTimestamp;
    patch.seedCursorId = result.cursorId;
  }

  await updateJob(patch);
  await triggerContinue(job.seq);
}

// Recalculate games into the build set, one page at a time.
async function stepRecalculating(job: RecalcJob) {
  const patch: Partial<RecalcJob> = {};
  let done: boolean;

  if (job.recalcMode === RecalcMode.WEB) {
    // Drain the queue: each game processed queues its players' next games.
    const result = await webRecalcPage(db, job);
    patch.processedGames = job.processedGames + result.processed;
    patch.queueSize = result.queueSize;
    patch.cursorTimestamp = result.lastTimestamp;
    done = result.done;
  } else {
    const result = await recalcElo(db, job.cursorTimestamp, undefined, {
      staged: true,
      set: job.buildSet,
    });
    patch.processedGames = job.processedGames + result.processed;
    patch.cursorTimestamp = result.lastTimestamp;
    // recalcElo pages with `completedAt >= cursor`, so the last game of
    // each page is re-read (idempotently) by the next. Out of work once a
    // page comes back empty or can't move the cursor forward.
    const advanced = result.lastTimestamp > job.cursorTimestamp;
    done = !advanced || result.processed === 0;
  }

  if (done) {
    patch.totalCommitItems = await countCommitItems(db, job);
    patch.commitStep = CommitStep.USERS;
    enterPhase(patch, RecalcPhase.COMMITTING);
  }

  await updateJob(patch);
  await triggerContinue(job.seq);
}

// Flip, then tear down the previous set.
async function stepCommitting(job: RecalcJob) {
  const step = job.commitStep ?? CommitStep.USERS;
  const patch: Partial<RecalcJob> = {};
  let written = 0;

  switch (step) {
    case CommitStep.USERS: {
      if (job.flip) await assertBuildSetPopulated(db, job);
      const systemRef = db.collection(SYSTEM).doc(STATS_CONFIG_DOC);
      written = (await commitUsers(db, job, systemRef)).written;
      patch.commitStep =
          job.flip ? CommitStep.NUKE_OLD_SET : CommitStep.CLEANUP;

      // Games that completed while the job ran were only written to the old
      // set (or copied before they finished). Re-run the live chain from
      // just before the job started so they land in the new live set too;
      // recalcElo is idempotent so re-doing a few is harmless.
      if (job.flip) await triggerLiveRecalc(job.startedAt - 60_000);
      break;
    }
    case CommitStep.NUKE_OLD_SET: {
      const {elo, u2u} = collectionsFor(job.liveSet);
      const result =
          await deleteDocsPage(db, [elo, u2u], COMMIT_DOCS_PER_BATCH);
      written = result.written;
      if (result.done) patch.commitStep = CommitStep.CLEANUP;
      break;
    }
    case CommitStep.CLEANUP: {
      const result = await deleteDocsPage(
          db, [USER_STATS_STAGING, queueRef(db)], COMMIT_DOCS_PER_BATCH);
      written = result.written;
      if (result.done) {
        patch.phase = RecalcPhase.DONE;
        patch.finishedAt = Date.now();
      }
      break;
    }
  }

  patch.committedItems = job.committedItems + written;
  await updateJob(patch);

  if (patch.phase !== RecalcPhase.DONE) {
    await triggerContinue(job.seq);
  } else {
    console.log(`job ${job.jobId} done`, {
      liveSet: job.flip ? job.buildSet : job.liveSet,
    });
  }
}

async function cancelJob() {
  const job = await loadJob();
  if (!job || !isActive(job)) return;
  await updateJob({
    phase: RecalcPhase.ERROR,
    error: 'Canceled by an admin. Live stats were not changed.',
    finishedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enterPhase(patch: Partial<RecalcJob>, phase: RecalcPhase) {
  patch.phase = phase;
  patch.phaseStartedAt = Date.now();
}

function isActive(job: RecalcJob): boolean {
  return job.phase !== RecalcPhase.DONE && job.phase !== RecalcPhase.ERROR;
}

async function loadJob(): Promise<RecalcJob|null> {
  const snap = await db.collection(ADMIN_JOBS).doc(CURRENT_JOB).get();
  return snap.exists ? snap.data() as RecalcJob : null;
}

async function updateJob(patch: Partial<RecalcJob>): Promise<void> {
  await db.collection(ADMIN_JOBS)
      .doc(CURRENT_JOB)
      .set({...patch, updatedAt: Date.now()}, {merge: true});
}

async function markJobError(err: unknown): Promise<void> {
  const job = await loadJob();
  if (!job || !isActive(job)) return;
  const message = err instanceof Error ? err.message : String(err);
  await updateJob({
    phase: RecalcPhase.ERROR,
    error: message,
    finishedAt: Date.now(),
  });
}

// `seq` must match the job's current seq for the step to run.
async function triggerContinue(seq: number): Promise<void> {
  await createCommand(CONTINUE_ACTION, {seq, triggeredAt: Date.now()});
}

async function triggerLiveRecalc(timestamp: number): Promise<void> {
  await createCommand(RECALC_ACTION, {timestamp: Math.max(0, timestamp)});
}

// onDocumentCreated only fires for a create, so a stale command doc has to
// go first — but only if it's really there: deleting a missing doc is a
// no-op in production and a spurious trigger in the emulator.
async function createCommand(action: string, data: object): Promise<void> {
  const ref = db.collection(ADMIN).doc(action);
  if ((await ref.get()).exists) await ref.delete();
  await ref.set(data);
}

function newJobId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
