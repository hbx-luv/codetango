import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';

import {User} from '../../../../types';
import {UserService} from '../../services/user.service';
import {PopoverAction} from '../actions-popover/actions-popover.component';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UsersComponent implements OnChanges {
  BASE_WIDTH = 75;

  @Input() userId: string;
  @Input() color: string;
  @Input() showUserName = true;
  @Input() navToScorecard = true;
  @Input() showActions = false;

  @Output() remove = new EventEmitter<void>();
  @Output() setSpymaster = new EventEmitter<void>();

  user$: Observable<User>;
  style: {width: string};

  actions: PopoverAction[] = [
    {
      label: 'Remove from Team',
      onClick: () => this.remove.emit(),
    },
    {
      label: 'Set Spymaster',
      onClick: () => this.setSpymaster.emit(),
    },
    {
      label: 'See Scorecard',
      onClick: () => this.router.navigate(['scorecard', this.userId]),
    },
  ];

  constructor(
      readonly authService: AuthService,
      private readonly userService: UserService,
      private readonly router: Router,
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

  goToUser($event) {
    if (this.navToScorecard) {
      $event.stopPropagation();
      this.router.navigate(['scorecard', this.userId]);
    }
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
    if (this.getColor === 'dark' || this.you) {
      return false;
    }
    return true;
  }

  get you(): boolean {
    return this.authService.currentUserId === this.userId;
  }
}
