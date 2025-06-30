import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AlertController} from '@ionic/angular';
import * as moment from 'moment';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {EloHistoryService} from 'src/app/services/elo-history.service';
import {GameService} from 'src/app/services/game.service';
import {UserService} from 'src/app/services/user.service';
import {Game, User, UserStats, GameStatus} from 'types';

const LIMIT = 3;
const CHART_LIMIT = 30;

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.page.html',
  styleUrls: ['./scorecard.page.scss'],
})
export class ScorecardPage {
  userId: string;
  user$: Observable<User>;
  recentGames$: Observable<Game[]>;
  gameTypeBreakdownDisplay$: Observable<{ key: string, played: number, won: number, percent: number, barWidth: number }[]>;

  chartLimit = CHART_LIMIT;

  // elos several days ago
  elo7DaysAgo?: number;
  elo30DaysAgo?: number;

  overallStats = [
    {title: 'Elo Rating', field: 'elo'},
    {title: 'Current Streak', field: 'currentStreak'},
    {title: 'Best Streak', field: 'bestStreak'},
    {title: 'Last Played', field: 'lastPlayed'}
  ];
  spymasterStats = [
    {title: 'Current Streak', field: 'spymasterStreak'},
    {title: 'Best Streak', field: 'spymasterBestStreak'},
  ];

  constructor(
      public readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly userService: UserService,
      private readonly route: ActivatedRoute,
      private readonly alertController: AlertController,
      private readonly eloHistoryService: EloHistoryService,

  ) {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.recentGames$ = this.gameService.getUserGames(this.userId, LIMIT);
    this.user$ = this.userService.getUser(this.userId).pipe(map(this.formatUserData.bind(this)));

    this.gameTypeBreakdownDisplay$ = this.gameService.getUserGames(this.userId).pipe(
      map(this.calculateGameTypeBreakdown.bind(this))
    );
  }

  private formatUserData(user: User): User {
    if (user.stats && typeof user.stats.lastPlayed === 'number') {
      user.stats.lastPlayed = moment(user.stats.lastPlayed).format('MMM D, YYYY');
      this.getRecentChanges(user.stats);
    }
    return user;
  }

  private calculateGameTypeBreakdown(games: Game[]): { key: string, played: number, won: number, percent: number, barWidth: number }[] {
    const breakdown: { [key: string]: { played: number; won: number } } = {};
    
    for (const game of games) {
      const type = game.gameType || 'UNKNOWN';
      if (!breakdown[type]) breakdown[type] = { played: 0, won: 0 };
      breakdown[type].played++;
      
      // Determine if user won
      const isRed = game.redTeam.userIds.includes(this.userId);
      const isBlue = game.blueTeam.userIds.includes(this.userId);
      const redWon = game.status === GameStatus.RED_WON;
      const blueWon = game.status === GameStatus.BLUE_WON;
      
      if ((isRed && redWon) || (isBlue && blueWon)) {
        breakdown[type].won++;
      }
    }
    
    // Convert to array and calculate percent
    const arr = Object.entries(breakdown).map(([key, value]) => ({
      key,
      played: value.played,
      won: value.won,
      percent: value.played ? value.won / value.played : 0
    }));
    
    // Sort by percent descending
    arr.sort((a, b) => b.percent - a.percent);
    
    // Find max percent for scaling
    const maxPercent = arr.length ? arr[0].percent : 1;
    
    // Add barWidth field (0-100)
    return arr.map(item => ({
      ...item,
      barWidth: maxPercent > 0 ? Math.round((item.percent / maxPercent) * 100) : 0
    }));
  }

  get isMe(): boolean {
    return this.userId === this.authService.currentUserId;
  }

  toggleChartLimit() {
    this.chartLimit = this.chartLimit > 0 ? 0 : CHART_LIMIT;
  }

  async promptForName(user: User) {
    const alert = await this.alertController.create({
      header: 'Set a nickname',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: user.nickname || user.name,
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Ok',
          handler: (data) => {
            this.userService.updateUser(this.userId, {nickname: data.name});
          }
        }
      ]
    });
    await alert.present();
  }

  async getRecentChanges(userStats: UserStats) {
    const midnight7DaysAgo = this.eloHistoryService.getMidnight(7);
    this.eloHistoryService.getEloAt(midnight7DaysAgo, this.userId)
        .then(stats => {
          this.elo7DaysAgo = userStats.elo - (stats ? stats.elo : 1200);
        });

    const midnight30DaysAgo = this.eloHistoryService.getMidnight(30);
    this.eloHistoryService.getEloAt(midnight30DaysAgo, this.userId)
        .then(stats => {
          this.elo30DaysAgo = userStats.elo - (stats ? stats.elo : 1200);
        });
  }
}
