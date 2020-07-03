import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
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

  constructor(
      private readonly userService: UserService,
      private readonly route: ActivatedRoute,
  ) {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.user$ = this.userService.getUser(this.userId);
  }
}
