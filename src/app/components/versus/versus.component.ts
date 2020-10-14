import {Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {UserToUserHistoryService} from 'src/app/services/user-to-user-history.service';
import {UserToUserStats} from 'types';

@Component({
  selector: 'app-versus',
  templateUrl: './versus.component.html',
  styleUrls: ['./versus.component.scss'],
})
export class VersusComponent {
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
