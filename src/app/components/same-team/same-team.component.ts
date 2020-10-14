import {Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {UserToUserHistoryService} from 'src/app/services/user-to-user-history.service';
import {UserToUserStats} from 'types';

@Component({
  selector: 'app-same-team',
  templateUrl: './same-team.component.html',
  styleUrls: ['./same-team.component.scss'],
})
export class SameTeamComponent {
  @Input() myUserId: string;
  @Input() theirUserId: string;

  record$: Observable<UserToUserStats>;

  constructor(
      private userToUserHistoryService: UserToUserHistoryService,
  ) {}

  ngOnChanges() {
    this.record$ = this.userToUserHistoryService.getUserToUserStats(
        this.myUserId, this.theirUserId);
  }
}
