import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
import {LeaderboardService} from 'src/app/services/leaderboard.service';
import {User} from 'types';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.page.html',
  styleUrls: ['./leaderboard.page.scss'],
})
export class LeaderboardPage {
  roomId: string;
  users$: Observable<User[]>;

  constructor(
      private readonly leaderboardService: LeaderboardService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.users$ = this.leaderboardService.getLeaderboard(this.roomId);
  }
}
