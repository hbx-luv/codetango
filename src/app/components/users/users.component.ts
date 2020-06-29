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
  @Input() color: string;
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

  get getColor(): string {
    if (this.color && this.color.toLowerCase() === 'red') {
      return 'danger';
    }
    if (this.color && this.color.toLowerCase() === 'blue') {
      return 'primary';
    }
    return 'dark';
  }

  get shouldOutline(): boolean {
    if (this.getColor === 'dark' ||
        this.authService.currentUserId === this.userId) {
      return false;
    }
    return true;
  }
}
