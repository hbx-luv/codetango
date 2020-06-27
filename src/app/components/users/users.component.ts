import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';

import {User} from '../../../../types';
import {UserService} from '../../services/user.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit {
  BASE_WIDTH = 75;

  @Input() userId: string;
  user$: Observable<User>;
  style: {width: string};

  constructor(
      private readonly userService: UserService,
  ) {
    this.style = {width: `${this.getRandomWidth()}px`};
  }

  ngOnInit() {
    this.user$ = this.userService.getUser(this.userId);
  }

  getRandomWidth() {
    return this.BASE_WIDTH + Math.floor(Math.random() * 20) + 1;
  }
}
