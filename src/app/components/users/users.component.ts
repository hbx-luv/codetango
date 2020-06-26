import {Component, Input, OnInit} from '@angular/core';
import {User} from '../../../../types';
import {UserService} from '../../services/user.service';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit {
  @Input() userId: string;
  user$: Observable<User>;

  constructor(
      private readonly userService: UserService
  ) { }

  ngOnInit() {
    this.user$ = this.userService.getUser(this.userId);
  }
}
