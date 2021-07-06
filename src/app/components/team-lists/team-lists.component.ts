import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, GameStatus, Room, RoomStatus} from '../../../../types';
import {RoomService} from '../../services/room.service';

@Component({
  selector: 'app-team-lists',
  templateUrl: './team-lists.component.html',
  styleUrls: ['./team-lists.component.scss'],
})
export class TeamListsComponent {
  @Input() room: Room;
  @Input() game: Game;
  @Input() setSpymaster: boolean;
  @Input() showScore = false;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
  ) {}

  get loggedInAndInRoom(): boolean {
    return this.isLoggedIn && this.room && this.isInRoom;
  }

  get isInRoom(): boolean {
    return this.room.userIds.includes(this.authService.currentUserId);
  }

  get isLoggedIn(): boolean {
    return this.authService.authenticated;
  }

  get notOnATeamYet(): boolean {
    return this.game &&
        !this.game.redTeam.userIds.includes(this.authService.currentUserId) &&
        !this.game.blueTeam.userIds.includes(this.authService.currentUserId);
  }

  showJoinButton(team: 'redTeam'|'blueTeam') {
    return this.game && !this.game.completedAt &&
        (this.canSwapTeams(team) || this.notOnATeamYet);
  }

  canSwapTeams(team: 'redTeam'|'blueTeam'): boolean {
    return this.game && this.room.status === RoomStatus.ASSIGNING_ROLES &&
        !this.game[team].userIds.includes(this.authService.currentUserId);
  }

  userClicked(userId: string, team: 'redTeam'|'blueTeam') {
    if (this.setSpymaster) {
      this.assignSpymaster(userId, team);
    }
  }

  async assignSpymaster(userId: string, team: 'redTeam'|'blueTeam') {
    let proceed = true;

    // when not in the set spymaster phase, confirm the change of spymaster
    if (!this.setSpymaster) {
      proceed = await this.utilService.confirm(
          'Change Spymaster?',
          'Are you sure you want to change the spymaster in the middle of a game?',
          'Set Spymaster', 'Nevermind');
    }

    if (proceed) {
      this.gameService.assignSpymaster(this.game.id, userId, team);
    }
  }

  async remove(userId: string, team: 'redTeam'|'blueTeam') {
    let proceed = true;

    // when not in the set spymaster phase, confirm the removal
    if (!this.setSpymaster) {
      proceed = await this.utilService.confirm(
          'Remove Player?',
          'Are you sure you want to remove this player in the middle of a game?',
          'Remove', 'Nevermind');
    }

    // quit early if they choose nevermind
    if (!proceed) return;

    this.gameService.removePlayerFromGame(this.game.id, userId);

    // in the case that the player being removed is the current spymaster,
    // delete the spymaster field
    const thisTeam = this.game[team];
    if (userId === thisTeam.spymaster) {
      thisTeam.spymaster = null;
    }
  }

  async joinTeam(team: 'redTeam'|'blueTeam') {
    if (!this.isLoggedIn) {
      await this.authService.loginWithGoogle();
    }

    if (!this.isInRoom) {
      this.roomService.joinRoom(this.room.id);
    }

    this.gameService.addPlayerToTeam(
        this.game.id,
        this.authService.currentUserId,
        team,
    );
  }
}
