import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AlertController} from '@ionic/angular';
import * as moment from 'moment';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {UserService} from 'src/app/services/user.service';
import {Game, User} from 'types';
const LIMIT = 3;
const CHART_LIMIT = 20;
@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.page.html',
  styleUrls: ['./scorecard.page.scss'],
})
export class ScorecardPage {
  userId: string;
  user$: Observable<User>;
  recentGames$: Observable<Game[]>;
  chartLimit = CHART_LIMIT;
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
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly userService: UserService,
      private readonly route: ActivatedRoute,
      private readonly alertController: AlertController,
  ) {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.recentGames$ = this.gameService.getUserGames(this.userId, LIMIT);
    this.user$ = this.userService.getUser(this.userId).pipe(map(user => {
      if (user.stats && typeof user.stats.lastPlayed === 'number') {
        user.stats.lastPlayed =
            moment(user.stats.lastPlayed).format('MMM D, YYYY');
      }
      return user;
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
            this.userService.updateUser(this.userId, {nickname: data.name})
          }
        }
      ]
    });
    await alert.present();
  }
}