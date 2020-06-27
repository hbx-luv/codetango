import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {Game, Room, RoomStatus} from 'types';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-game-join-button',
  templateUrl: './game-join-button.component.html',
  styleUrls: ['./game-join-button.component.scss'],
})
export class GameJoinButtonComponent {
  @Input() room: Room;
  @Input() game: Game;

  constructor(
      private readonly authService: AuthService,
      private readonly roomService: RoomService,
      private readonly gameService: GameService,
  ) {}

  get showLogin(): boolean {
    return this.room && !this.authService.authenticated;
  }

  get showJoin(): boolean {
    return this.authService.authenticated && this.room &&
        !this.room.userIds.includes(this.authService.currentUserId);
  }

  login() {
    this.authService.loginWithGoogle();
  }

  join() {
    this.roomService.joinRoom(this.room.id);
  }

  joinTeam(team: string) {
    if (team === 'RED') {
      this.game.redTeam.userIds.push(this.authService.currentUserId);
    } else if (team === 'BLUE') {
      this.game.blueTeam.userIds.push(this.authService.currentUserId);
    }
    this.gameService.updateGame(this.game.id, this.game);
  }
  // Join a team when a game is already in progress
  get showJoinTeamButtons(): boolean {
    const currentUserId = this.authService.currentUserId;
    const loggedInAndInRoom = this.authService.authenticated && this.room &&
        this.room.userIds.includes(currentUserId);

    const isOnTeam = this.game &&
        (this.game.redTeam.userIds.includes(currentUserId) ||
         this.game.blueTeam.userIds.includes(currentUserId));

    return loggedInAndInRoom && !isOnTeam &&
        this.room.status === RoomStatus.GAME_IN_PROGRESS;
  }
}
