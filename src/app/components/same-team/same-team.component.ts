import {Component, Input, OnChanges} from '@angular/core';
import {Observable} from 'rxjs';
import {UserToUserHistoryService} from 'src/app/services/user-to-user-history.service';
import {UserToUserStats} from 'types';

@Component({
  standalone: false,
  selector: 'app-same-team',
  templateUrl: './same-team.component.html',
  styleUrls: ['./same-team.component.scss'],
})
export class SameTeamComponent implements OnChanges {
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
