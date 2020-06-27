import {Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';

import {User} from '../../../../types';
import {UserService} from '../../services/user.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent {
  BASE_WIDTH = 75;

  @Input() userId: string;
  user$: Observable<User>;
  style: {width: string};

  constructor(
      readonly authService: AuthService,
      private readonly userService: UserService,
  ) {
    this.style = {width: `${this.getRandomWidth()}px`};
  }

  ngOnChanges() {
    if (this.userId) {
      this.user$ = this.userService.getUser(this.userId);
    }
  }

  getRandomWidth() {
    return this.BASE_WIDTH + Math.floor(Math.random() * 20) + 1;
  }
}
