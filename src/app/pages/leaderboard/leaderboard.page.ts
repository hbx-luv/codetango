import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {LeaderboardService} from 'src/app/services/leaderboard.service';
import {User} from 'types';

const ONE_DAY = 1000 * 60 * 60 * 24;
const RECENT_DAYS = 30;
const MIN_PLAYERS = 5;

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.page.html',
  styleUrls: ['./leaderboard.page.scss'],
})
export class LeaderboardPage implements OnDestroy {
  private destroyed$ = new Subject<void>();

  roomId: string;
  users$: Observable<User[]>;

  onlyShowRecent = true;

  hasGames: User[];
  playedRecently: User[];

  constructor(
      private readonly leaderboardService: LeaderboardService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.leaderboardService.getLeaderboard(this.roomId)
        .pipe(takeUntil(this.destroyed$))
        .subscribe(users => {
          this.hasGames = users.filter(user => user.stats.gamesPlayed > 0);

          const recentTimestamp = Date.now() - (ONE_DAY * RECENT_DAYS);
          this.playedRecently = this.hasGames.filter(
              user => user.stats?.lastPlayed > recentTimestamp);
        });
  }

  get users(): User[] {
    if (this.onlyShowRecent && this.hasRecentPlayers) {
      return this.playedRecently;
    } else {
      return this.hasGames;
    }
  }

  get recentIcon(): string {
    return this.onlyShowRecent ? 'time' : 'time-outline';
  }

  get hasRecentPlayers(): boolean {
    return this.playedRecently?.length >= MIN_PLAYERS;
  }

  toggleRecent() {
    this.onlyShowRecent = !this.onlyShowRecent;
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }
}
