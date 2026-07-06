import {Component, OnDestroy} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {map, startWith, takeUntil} from 'rxjs/operators';
import {AdminService} from 'src/app/services/admin.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';
import {WordListsService} from 'src/app/services/word-lists.service';
import {RecalcJob, RecalcPhase, User, UserRole} from 'types';

interface JobDisplay {
  active: boolean;
  job?: RecalcJob;
  label: string;
  detail: string;
  progress: number;  // 0..1
  showBar: boolean;
  color: string;
  finished: boolean;
  errored: boolean;
}

@Component({
  standalone: false,
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnDestroy {
  private readonly destroyed = new ReplaySubject<void>();

  // Full user list, kept in memory so both pickers can filter locally.
  users: User[] = [];
  filteredOldUsers: User[] = [];
  filteredNewUsers: User[] = [];
  oldUserQuery = '';
  newUserQuery = '';
  oldUser?: User;
  newUser?: User;

  // Games belonging to the currently-selected oldUser — shown in the merge
  // preview so the admin sees the size of what they're about to do.
  oldUserGameCount?: number;

  // Live job status.
  jobDisplay: JobDisplay = {
    active: false,
    label: '',
    detail: '',
    progress: 0,
    showBar: false,
    color: 'primary',
    finished: false,
    errored: false,
  };

  constructor(
      private readonly adminService: AdminService,
      private readonly userService: UserService,
      private readonly utilService: UtilService,
      public readonly wordListsService: WordListsService,
  ) {
    this.adminService.getAllUsers()
        .pipe(
            takeUntil(this.destroyed),
            map(users => this.sortUsers(users)),
            )
        .subscribe(users => {
          this.users = users;
          this.refilterOldUsers();
          this.refilterNewUsers();
        });

    this.adminService.getCurrentJob()
        .pipe(
            takeUntil(this.destroyed),
            startWith(undefined),
            )
        .subscribe(job => this.jobDisplay = this.buildJobDisplay(job));
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get showAdmin(): boolean {
    return this.userService.currentUser?.role === UserRole.ADMIN;
  }

  get mergeReady(): boolean {
    return !!this.oldUser && !!this.newUser &&
        this.oldUser.id !== this.newUser.id && !this.jobDisplay.active;
  }

  get mergeDisabledReason(): string {
    if (this.jobDisplay.active) return 'A job is already running.';
    if (!this.oldUser) return 'Pick the account to merge FROM.';
    if (!this.newUser) return 'Pick the account to merge INTO.';
    if (this.oldUser.id === this.newUser.id) return 'Pick two different users.';
    return '';
  }

  onOldQueryChange(value: string) {
    this.oldUserQuery = value ?? '';
    this.refilterOldUsers();
  }

  onNewQueryChange(value: string) {
    this.newUserQuery = value ?? '';
    this.refilterNewUsers();
  }

  async selectOldUser(user: User) {
    this.oldUser = user;
    this.oldUserQuery = this.displayName(user);
    this.filteredOldUsers = [];
    this.oldUserGameCount = undefined;
    try {
      this.oldUserGameCount =
          await this.adminService.countGamesForUser(user.id!);
    } catch (_e) {
      this.oldUserGameCount = undefined;
    }
  }

  selectNewUser(user: User) {
    this.newUser = user;
    this.newUserQuery = this.displayName(user);
    this.filteredNewUsers = [];
  }

  clearOldUser() {
    this.oldUser = undefined;
    this.oldUserGameCount = undefined;
    this.oldUserQuery = '';
    this.refilterOldUsers();
  }

  clearNewUser() {
    this.newUser = undefined;
    this.newUserQuery = '';
    this.refilterNewUsers();
  }

  async mergeUsers() {
    if (!this.mergeReady) return;
    const from = this.displayName(this.oldUser!);
    const to = this.displayName(this.newUser!);
    const gamesLine = this.oldUserGameCount !== undefined ?
        `${this.oldUserGameCount} game${
            this.oldUserGameCount === 1 ? '' : 's'} will be rewritten. ` :
        '';
    const doIt = await this.utilService.confirm(
        `Merge ${from} into ${to}?`,
        `${gamesLine}All Elo history and stats will be recalculated from ` +
            `scratch into a staging area, then swapped in when ready. ` +
            `This cannot be undone.`,
        'Merge',
        'Cancel',
    );
    if (!doIt) return;

    try {
      await this.adminService.startMerge(
          this.oldUser!.id!,
          this.newUser!.id!,
          this.displayName(this.oldUser!),
          this.displayName(this.newUser!),
      );
      this.utilService.showToast('Merge started');
      this.clearOldUser();
      this.clearNewUser();
    } catch (e) {
      this.utilService.showToast(`Failed to start merge: ${e}`);
    }
  }

  async recalcAll() {
    const doIt = await this.utilService.confirm(
        'Recalculate all stats?',
        'The full Elo history and every user\'s stats will be rebuilt in a ' +
            'staging area, then swapped in. Live stats stay put until the ' +
            'commit phase.',
        'Recalculate',
        'Cancel',
    );
    if (!doIt) return;

    try {
      await this.adminService.startRecalc();
      this.utilService.showToast('Recalc started');
    } catch (e) {
      this.utilService.showToast(`Failed to start recalc: ${e}`);
    }
  }

  displayName(user: User): string {
    return user.nickname || user.name || user.email || user.id || 'Unknown';
  }

  private sortUsers(users: User[]): User[] {
    return [...users].sort(
        (a, b) => this.displayName(a).localeCompare(this.displayName(b)));
  }

  private refilterOldUsers() {
    this.filteredOldUsers = this.filterUsers(this.oldUserQuery, this.oldUser);
  }

  private refilterNewUsers() {
    this.filteredNewUsers = this.filterUsers(this.newUserQuery, this.newUser);
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

  private buildJobDisplay(job?: RecalcJob): JobDisplay {
    if (!job) {
      return {
        active: false,
        label: '',
        detail: '',
        progress: 0,
        showBar: false,
        color: 'primary',
        finished: false,
        errored: false,
      };
    }

    const type = job.type === 'merge' ? 'Merge' : 'Recalc';
    const oldName = job.oldUserName || job.oldUserId;
    const newName = job.newUserName || job.newUserId;

    switch (job.phase) {
      case RecalcPhase.MIGRATING: {
        const total = Math.max(job.totalGames, job.migratedGames);
        const progress = total > 0 ? job.migratedGames / total : 0;
        return {
          active: true,
          job,
          label: `${type} · migrating games`,
          detail: `${oldName} → ${newName} · ${job.migratedGames.toLocaleString()} game${
              job.migratedGames === 1 ? '' : 's'} rewritten`,
          progress,
          showBar: total > 0,
          color: 'primary',
          finished: false,
          errored: false,
        };
      }
      case RecalcPhase.RECALCULATING: {
        const total = job.totalGames || 0;
        const progress = total > 0 ? job.processedGames / total : 0;
        return {
          active: true,
          job,
          label: `${type} · recalculating stats (staging)`,
          detail: `${job.processedGames.toLocaleString()} / ${
              total.toLocaleString()} games processed · live stats untouched`,
          progress,
          showBar: total > 0,
          color: 'primary',
          finished: false,
          errored: false,
        };
      }
      case RecalcPhase.COMMITTING: {
        const total = job.totalCommitItems || 0;
        const progress = total > 0 ? job.committedItems / total : 0;
        return {
          active: true,
          job,
          label: `${type} · committing to live`,
          detail: `${job.committedItems.toLocaleString()} / ${
              total.toLocaleString()} items written`,
          progress,
          showBar: total > 0,
          color: 'success',
          finished: false,
          errored: false,
        };
      }
      case RecalcPhase.DONE:
        return {
          active: false,
          job,
          label: `${type} complete`,
          detail: `Finished ${this.formatElapsed(job)}`,
          progress: 1,
          showBar: false,
          color: 'success',
          finished: true,
          errored: false,
        };
      case RecalcPhase.ERROR:
        return {
          active: false,
          job,
          label: `${type} failed`,
          detail: job.error || 'Unknown error',
          progress: 0,
          showBar: false,
          color: 'danger',
          finished: true,
          errored: true,
        };
      default:
        return {
          active: false,
          job,
          label: type,
          detail: '',
          progress: 0,
          showBar: false,
          color: 'primary',
          finished: false,
          errored: false,
        };
    }
  }

  private formatElapsed(job: RecalcJob): string {
    if (!job.finishedAt || !job.startedAt) return '';
    const ms = job.finishedAt - job.startedAt;
    const s = Math.round(ms / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `in ${m}m ${rem}s`;
  }
}
