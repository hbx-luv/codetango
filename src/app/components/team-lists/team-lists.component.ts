import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';

import {Game, Room, RoomStatus} from '../../../../types';

@Component({
  selector: 'app-team-lists',
  templateUrl: './team-lists.component.html',
  styleUrls: ['./team-lists.component.scss'],
})
export class TeamListsComponent {
  @Input() room: Room;
  @Input() game: Game;
  @Input() setSpymaster: boolean;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
  ) {}

  // Join a team when a game is already in progress
  get showJoinTeamButtons(): boolean {
    const currentUserId = this.authService.currentUserId;
    const loggedInAndInRoom = this.authService.authenticated && this.room &&
        this.room.userIds.includes(currentUserId);

    const isOnTeam = this.game &&
        (this.game.redTeam.userIds.includes(currentUserId) ||
         this.game.blueTeam.userIds.includes(currentUserId));

    return loggedInAndInRoom && !isOnTeam;
  }

  userClicked(userId: string, team: 'redTeam'|'blueTeam') {
    if (this.setSpymaster) {
      this.gameService.assignSpymaster(this.game.id, userId, team);
    }
  }

  joinTeam(team: 'redTeam'|'blueTeam') {
    this.gameService.addPlayerToTeam(
        this.game.id,
        this.authService.currentUserId,
        team,
    );
  }
}
