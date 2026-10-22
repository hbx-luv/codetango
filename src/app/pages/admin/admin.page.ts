import {Component, OnDestroy} from '@angular/core';
import {DateTime} from 'luxon';
import {combineLatest, interval, ReplaySubject} from 'rxjs';
import {map, startWith, takeUntil} from 'rxjs/operators';
import {AdminService} from 'src/app/services/admin.service';
import {StatsSetService} from 'src/app/services/stats-set.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';
import {WordListsService} from 'src/app/services/word-lists.service';
import {
  CommitStep,
  MergePair,
  RecalcJob,
  RecalcJobType,
  RecalcMode,
  RecalcPhase,
  StatsSet,
  User,
  UserRole,
} from 'types';

// A job whose status doc hasn't moved in this long is assumed to have lost
// its continue trigger (function instance died mid-step) and can be resumed.
const STALLED_AFTER_MS = 5 * 60 * 1000;

type Side = 'old'|'new';

// One row of the merge form: the account to fold away and where it goes.
interface PairRow {
  old?: User;
  new?: User;
  oldQuery: string;
  newQuery: string;
  oldResults: User[];
  newResults: User[];
  oldGameCount?: number;
}

type StepState = 'done'|'active'|'todo'|'skipped';

interface JobStep {
  label: string;
  state: StepState;
}

interface JobView {
  job: RecalcJob;
  active: boolean;
  finished: boolean;
  errored: boolean;
  stalled: boolean;
  title: string;
  phaseLabel: string;
  detail: string;
  note: string;
  warnings: string[];
  pairs: string[];
  steps: JobStep[];
  progress?: number;  // 0..1, undefined = indeterminate
  elapsed: string;
  eta: string;
}

@Component({
  standalone: false,
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnDestroy {
  private readonly destroyed = new ReplaySubject<void>();

  // Full user list, kept in memory so the pickers can filter locally.
  users: User[] = [];
  pairs: PairRow[] = [this.emptyRow()];

  view?: JobView;
  liveSet: StatsSet = StatsSet.BLUE;
  starting = false;

  constructor(
      private readonly adminService: AdminService,
      private readonly userService: UserService,
      private readonly utilService: UtilService,
      private readonly statsSetService: StatsSetService,
      public readonly wordListsService: WordListsService,
  ) {
    this.adminService.getAllUsers()
        .pipe(
            takeUntil(this.destroyed),
            map(users => this.sortUsers(users)),
            )
        .subscribe(users => {
          this.users = users;
          for (const row of this.pairs) {
            this.refilter(row, 'old');
            this.refilter(row, 'new');
          }
        });

    this.statsSetService.liveSet$.pipe(takeUntil(this.destroyed))
        .subscribe(set => this.liveSet = set);

    // Re-render once a second so elapsed time and the ETA keep moving
    // between status-doc writes.
    combineLatest([
      this.adminService.getCurrentJob().pipe(startWith(undefined)),
      interval(1000).pipe(startWith(0)),
    ])
        .pipe(takeUntil(this.destroyed))
        .subscribe(([job]) => {
          // A status doc without recalcMode was written by the previous
          // recalc design; nothing about it maps onto this card.
          this.view = job?.recalcMode ? this.buildView(job) : undefined;
        });
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get showAdmin(): boolean {
    return this.userService.currentUser?.role === UserRole.ADMIN;
  }

  get jobActive(): boolean {
    return !!this.view?.active;
  }

  // -- Merge form -----------------------------------------------------------

  get completePairs(): MergePair[] {
    return this.pairs.filter(r => r.old && r.new).map(r => ({
      oldUserId: r.old!.id!,
      newUserId: r.new!.id!,
      oldUserName: this.displayName(r.old!),
      newUserName: this.displayName(r.new!),
    }));
  }

  get mergeDisabledReason(): string {
    if (this.jobActive) return 'Wait for the running job to finish.';
    const complete = this.completePairs;
    if (complete.length === 0) return 'Pick an old and a new account.';
    if (complete.length < this.pairs.length) {
      return 'Finish or remove the incomplete row.';
    }
    if (complete.some(p => p.oldUserId === p.newUserId)) {
      return 'Old and new must be different accounts.';
    }
    const olds = complete.map(p => p.oldUserId);
    if (new Set(olds).size !== olds.length) {
      return 'The same old account is listed twice.';
    }
    if (complete.some(p => olds.includes(p.newUserId))) {
      return 'An account can\'t be both old and new.';
    }
    return '';
  }

  get mergeReady(): boolean {
    return !this.starting && this.mergeDisabledReason === '';
  }

  get totalMergeGames(): number {
    return this.pairs.reduce((sum, r) => sum + (r.oldGameCount ?? 0), 0);
  }

  addPair() {
    this.pairs.push(this.emptyRow());
  }

  removePair(index: number) {
    this.pairs.splice(index, 1);
    if (this.pairs.length === 0) this.pairs.push(this.emptyRow());
  }

  onQueryChange(row: PairRow, side: Side, value: string|null|undefined) {
    if (side === 'old') {
      row.oldQuery = value ?? '';
    } else {
      row.newQuery = value ?? '';
    }
    this.refilter(row, side);
  }

  async select(row: PairRow, side: Side, user: User) {
    if (side === 'old') {
      row.old = user;
      row.oldQuery = this.displayName(user);
      row.oldResults = [];
      row.oldGameCount = undefined;
      try {
        row.oldGameCount = await this.adminService.countGamesForUser(user.id!);
      } catch (_e) {
        row.oldGameCount = undefined;
      }
    } else {
      row.new = user;
      row.newQuery = this.displayName(user);
      row.newResults = [];
    }
  }

  clear(row: PairRow, side: Side) {
    if (side === 'old') {
      row.old = undefined;
      row.oldGameCount = undefined;
      row.oldQuery = '';
    } else {
      row.new = undefined;
      row.newQuery = '';
    }
    this.refilter(row, side);
  }

  async mergeUsers() {
    if (!this.mergeReady) return;
    const pairs = this.completePairs;
    const lines = pairs.map(p => `${p.oldUserName} → ${p.newUserName}`);
    const games = this.totalMergeGames;
    const doIt = await this.utilService.confirm(
        `Merge ${pairs.length} player${pairs.length === 1 ? '' : 's'}?`,
        `${lines.join('\n')}\n\n` +
            `${games.toLocaleString()} game${games === 1 ? '' : 's'} will ` +
            `be rewritten, then every game downstream of them is rebuilt ` +
            `into the inactive ${this.buildSetName} set. Live stats ` +
            `don't change until the rebuild is complete. This cannot be ` +
            `undone.`,
        'Merge',
        'Cancel',
    );
    if (!doIt) return;

    this.starting = true;
    try {
      await this.adminService.startMerge(pairs);
      this.utilService.showToast('Merge started');
      this.pairs = [this.emptyRow()];
    } catch (e) {
      this.utilService.showToast(`Failed to start merge: ${e}`);
    } finally {
      this.starting = false;
    }
  }

  async recalcAll() {
    const doIt = await this.utilService.confirm(
        'Recalculate all stats?',
        `Every player's stats and Elo history will be rebuilt from every ` +
            `completed game into the inactive ${this.buildSetName} set, ` +
            `then swapped in with one flip. Live stats don't change until ` +
            `the rebuild is complete.`,
        'Recalculate',
        'Cancel',
    );
    if (!doIt) return;

    this.starting = true;
    try {
      await this.adminService.startRecalc();
      this.utilService.showToast('Recalc started');
    } catch (e) {
      this.utilService.showToast(`Failed to start recalc: ${e}`);
    } finally {
      this.starting = false;
    }
  }

  async resumeJob() {
    const job = this.view?.job;
    if (!job) return;
    try {
      await this.adminService.resumeJob(job.seq);
      this.utilService.showToast('Nudged the job');
    } catch (e) {
      this.utilService.showToast(`Failed to resume: ${e}`);
    }
  }

  async cancelJob() {
    const job = this.view?.job;
    if (!job) return;
    const committing = job.phase === RecalcPhase.COMMITTING;
    const doIt = await this.utilService.confirm(
        'Cancel this job?',
        committing ?
            'The job is already committing. Canceling now can leave the ' +
                'old set partially deleted — only do this if it\'s stuck.' :
            'Nothing live has changed yet. The partial rebuild is thrown ' +
                'away the next time a job starts.',
        'Cancel job',
        'Keep running',
    );
    if (!doIt) return;
    try {
      await this.adminService.cancelJob();
    } catch (e) {
      this.utilService.showToast(`Failed to cancel: ${e}`);
    }
  }

  get buildSetName(): string {
    return this.liveSet === StatsSet.BLUE ? StatsSet.GREEN : StatsSet.BLUE;
  }

  displayName(user: User): string {
    return user.nickname || user.name || user.email || user.id || 'Unknown';
  }

  // "412 games · last played Mar 3, 2024", so look-alike accounts can be
  // told apart in the pickers. Stats come from the last recalc.
  userMeta(user: User): string {
    const played = user.stats?.gamesPlayed ?? 0;
    if (!played) return 'No games played';
    const games = `${played.toLocaleString()} game${played === 1 ? '' : 's'}`;
    const last = user.stats?.lastPlayed;
    return typeof last === 'number' ?
        `${games} · last played ${this.formatDate(last)}` :
        games;
  }

  // -- Private --------------------------------------------------------------

  private emptyRow(): PairRow {
    return {oldQuery: '', newQuery: '', oldResults: [], newResults: []};
  }

  private sortUsers(users: User[]): User[] {
    return [...users].sort(
        (a, b) => this.displayName(a).localeCompare(this.displayName(b)));
  }

  private refilter(row: PairRow, side: Side) {
    if (side === 'old') {
      row.oldResults = this.filterUsers(row.oldQuery, row.old);
    } else {
      row.newResults = this.filterUsers(row.newQuery, row.new);
    }
  }

  // Simple case-insensitive substring search across name/nickname/email/id.
  // If a user is already selected and the query still matches their name,
  // don't show the dropdown — this keeps the field looking "closed".
  private filterUsers(rawQuery: string, selected?: User): User[] {
    const query = (rawQuery ?? '').trim().toLowerCase();
    if (!query) return [];
    if (selected && query === this.displayName(selected).toLowerCase()) {
      return [];
    }
    return this.users
        .filter(u => !u.isBot)
        .filter(u => {
          const haystack = [
            u.name,
            u.nickname,
            u.email,
            u.id,
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(query);
        })
        .slice(0, 12);
  }

  // -- Job view -------------------------------------------------------------

  private buildView(job: RecalcJob): JobView {
    const now = Date.now();
    const active =
        job.phase !== RecalcPhase.DONE && job.phase !== RecalcPhase.ERROR;
    const merge = job.type === RecalcJobType.MERGE;
    const pairs = (job.pairs ?? []).map(p => `${p.oldUserName || p.oldUserId} → ${
        p.newUserName || p.newUserId}`);
    const title = merge ?
        `Merge ${pairs.length} player${pairs.length === 1 ? '' : 's'}` :
        'Full recalculation';

    const view: JobView = {
      job,
      active,
      finished: job.phase === RecalcPhase.DONE,
      errored: job.phase === RecalcPhase.ERROR,
      stalled: active && now - (job.updatedAt ?? now) > STALLED_AFTER_MS,
      title,
      phaseLabel: '',
      detail: '',
      note: '',
      warnings: job.warnings ?? [],
      pairs,
      steps: this.buildSteps(job),
      progress: undefined,
      elapsed: this.formatDuration((job.finishedAt ?? now) - job.startedAt),
      eta: '',
    };

    const buildSet = job.buildSet;
    const liveSet = job.liveSet;

    switch (job.phase) {
      case RecalcPhase.CLEARING:
        view.phaseLabel = 'Clearing the build set';
        view.detail = job.totalClearDocs > 0 ?
            `${this.ratio(job.clearedDocs, job.totalClearDocs)} stale records removed from ${buildSet}` :
            `The ${buildSet} set is already empty`;
        view.progress = this.fraction(job.clearedDocs, job.totalClearDocs);
        view.eta = this.estimate(job, job.clearedDocs, job.totalClearDocs);
        break;
      case RecalcPhase.MIGRATING:
        view.phaseLabel = 'Rewriting games';
        view.detail = `${this.ratio(job.migratedGames, job.totalMigrateGames)} games moved to their new accounts`;
        view.progress = this.fraction(job.migratedGames, job.totalMigrateGames);
        view.eta = this.estimate(job, job.migratedGames, job.totalMigrateGames);
        if (job.recalcFrom > 0) {
          view.note = `Earliest affected game: ${this.formatDate(job.recalcFrom)}`;
        }
        break;
      case RecalcPhase.SEEDING:
        view.phaseLabel = 'Copying history';
        view.detail = `${this.ratio(job.seededDocs, job.totalSeedDocs)} records copied into ${buildSet}`;
        view.progress = this.fraction(job.seededDocs, job.totalSeedDocs);
        view.eta = this.estimate(job, job.seededDocs, job.totalSeedDocs);
        view.note = 'Games touched by the merge are rebuilt on top of this copy';
        break;
      case RecalcPhase.RECALCULATING:
        view.phaseLabel = 'Recalculating stats';
        if (job.recalcMode === RecalcMode.WEB) {
          // The queue only reaches games downstream of a change, so the
          // total is a ceiling, not a target.
          view.detail = `${(job.processedGames ?? 0).toLocaleString()} games rebuilt · ${
              (job.queueSize ?? 0).toLocaleString()} queued · at most ${
              (job.totalGames ?? 0).toLocaleString()} affected`;
          view.note = `Following each player's next game from ${
              this.formatDate(job.recalcFrom)} · live stats still served from ${liveSet}`;
        } else {
          view.detail = `${this.ratio(job.processedGames, job.totalGames)} games rebuilt into ${buildSet}`;
          view.note = `Live stats still served from ${liveSet}`;
        }
        view.progress = this.fraction(job.processedGames, job.totalGames);
        view.eta = this.estimate(job, job.processedGames, job.totalGames);
        break;
      case RecalcPhase.COMMITTING:
        view.phaseLabel = this.commitLabel(job);
        view.detail = `${this.ratio(job.committedItems, job.totalCommitItems)} writes`;
        view.progress = this.fraction(job.committedItems, job.totalCommitItems);
        view.eta = this.estimate(job, job.committedItems, job.totalCommitItems);
        view.note = job.flip ?
            (job.commitStep === CommitStep.USERS ?
                 `About to flip live stats from ${liveSet} to ${buildSet}` :
                 `Live stats now served from ${buildSet}`) :
            'Nothing to recalculate — leaving the live set as is';
        break;
      case RecalcPhase.DONE:
        view.phaseLabel = 'Complete';
        view.detail = `Finished in ${view.elapsed}`;
        view.progress = 1;
        view.note = job.flip ?
            `Live stats are now served from the ${buildSet} set` :
            'No completed games changed hands, so stats were left as they were';
        break;
      case RecalcPhase.ERROR:
        view.phaseLabel = 'Failed';
        view.detail = job.error || 'Unknown error';
        view.note = job.commitStep ?
            'The job failed while committing — check the live set before retrying' :
            'Live stats were not changed';
        break;
    }

    if (view.stalled) {
      view.note = `No progress for ${this.formatDuration(now - job.updatedAt)}. ` +
          `The step may have died — resume to re-trigger it.`;
    }

    return view;
  }

  private buildSteps(job: RecalcJob): JobStep[] {
    const merge = job.type === RecalcJobType.MERGE;
    const order: Array<{phase: RecalcPhase, label: string, show: boolean}> = [
      {phase: RecalcPhase.CLEARING, label: 'Clear', show: true},
      {phase: RecalcPhase.MIGRATING, label: 'Rewrite games', show: merge},
      {phase: RecalcPhase.SEEDING, label: 'Copy history', show: merge},
      {phase: RecalcPhase.RECALCULATING, label: 'Recalculate', show: true},
      {phase: RecalcPhase.COMMITTING, label: 'Flip & clean up', show: true},
    ];
    const phases = order.filter(o => o.show);
    const current = job.phase === RecalcPhase.DONE ?
        phases.length :
        phases.findIndex(o => o.phase === job.phase);
    // A merge with no completed games skips seeding and recalculating.
    const skipped = new Set<RecalcPhase>(
        job.flip ? [] : [RecalcPhase.SEEDING, RecalcPhase.RECALCULATING]);

    return phases.map((o, i) => {
      let state: StepState;
      if (skipped.has(o.phase)) {
        state = 'skipped';
      } else if (i < current || job.phase === RecalcPhase.DONE) {
        state = 'done';
      } else if (i === current) {
        state = job.phase === RecalcPhase.ERROR ? 'todo' : 'active';
      } else {
        state = 'todo';
      }
      return {label: o.label, state};
    });
  }

  private commitLabel(job: RecalcJob): string {
    switch (job.commitStep) {
      case CommitStep.NUKE_OLD_SET:
        return `Deleting the old ${job.liveSet} set`;
      case CommitStep.CLEANUP:
        return 'Cleaning up';
      default:
        return job.flip ? 'Writing player stats & flipping' :
                          'Writing player stats';
    }
  }

  private ratio(done: number, total: number): string {
    return `${(done ?? 0).toLocaleString()} / ${(total ?? 0).toLocaleString()}`;
  }

  private fraction(done: number, total: number): number|undefined {
    if (!total || total <= 0) return undefined;
    return Math.min(1, (done ?? 0) / total);
  }

  // Linear estimate from this phase's own rate; blank until there's enough
  // progress to be meaningful.
  private estimate(job: RecalcJob, done: number, total: number): string {
    if (!total || !done || done >= total) return '';
    const elapsed = Date.now() - (job.phaseStartedAt || job.startedAt);
    if (elapsed < 3000) return '';
    const remainingMs = (elapsed / done) * (total - done);
    return `about ${this.formatDuration(remainingMs)} left`;
  }

  private formatDuration(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  private formatDate(ms: number): string {
    return DateTime.fromMillis(ms).toFormat('LLL d, yyyy');
  }
}
