import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import * as moment from 'moment';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {GameService} from 'src/app/services/game.service';
import {UserService} from 'src/app/services/user.service';
import {Game, User} from 'types';

const LIMIT = 3;

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.page.html',
  styleUrls: ['./scorecard.page.scss'],
})
export class ScorecardPage {
  userId: string;
  user$: Observable<User>;
  recentGames$: Observable<Game[]>;

  overallStats = [
    {title: 'Elo Rating', field: 'elo'},
    {title: 'Current Streak', field: 'currentStreak'},
    {title: 'Best Streak', field: 'bestStreak'},
    {title: 'Last Played', field: 'lastPlayed'}
  ];

  constructor(
      private readonly gameService: GameService,
      private readonly userService: UserService,
      private readonly route: ActivatedRoute,
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
}
