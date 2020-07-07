import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import * as moment from 'moment';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {UserService} from 'src/app/services/user.service';
import {User} from 'types';

@Component({
  selector: 'app-scorecard',
  templateUrl: './scorecard.page.html',
  styleUrls: ['./scorecard.page.scss'],
})
export class ScorecardPage {
  userId: string;
  user$: Observable<User>;

  stats = [
    {title: 'Elo Rating', field: 'elo'},
    {title: 'Games Played', field: 'gamesPlayed'},
    {title: 'Games Won', field: 'gamesWon'},
    {title: 'Spymaster Games', field: 'spymasterGames'},
    {title: 'Spymaster Wins', field: 'spymasterWins'},
    {title: 'Current Streak', field: 'currentStreak'},
    {title: 'Best Streak', field: 'bestStreak'},
    {title: 'Last Played', field: 'lastPlayed'}
  ];

  constructor(
      private readonly userService: UserService,
      private readonly route: ActivatedRoute,
  ) {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.user$ = this.userService.getUser(this.userId).pipe(map(user => {
      if (user.stats && typeof user.stats.lastPlayed === 'number') {
        user.stats.lastPlayed =
            moment(user.stats.lastPlayed).format('MMM D, YYYY');
      }
      return user;
    }));
  }
}
