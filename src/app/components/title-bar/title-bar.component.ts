import {Component, Input} from '@angular/core';

import {Game, GameStatus, Room, RoomStatus} from '../../../../types';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-title-bar',
  templateUrl: './title-bar.component.html',
  styleUrls: ['./title-bar.component.scss'],
})
export class TitleBarComponent {
  @Input() room: Room;
  @Input() game: Game;

  constructor(
      readonly authService: AuthService,
  ) {}

  get toolbarColor(): string {
    if (this.gameInProgress) {
      switch (this.game.status) {
        case GameStatus.BLUES_TURN:
        case GameStatus.BLUE_WON:
          return 'primary';
        case GameStatus.REDS_TURN:
        case GameStatus.RED_WON:
          return 'danger';
        default:
          return 'light';
      }
    }

    return 'light';
  }

  get gameInProgress(): boolean {
    return this.room && this.game && [
      RoomStatus.GAME_IN_PROGRESS,
      RoomStatus.GAME_ENDED,
    ].includes(this.room.status);
  }

  get loggedInUserIsSpyMaster(): boolean {
    return this.game &&
        (this.game.redTeam.spymaster === this.authService.currentUserId ||
         this.game.blueTeam.spymaster === this.authService.currentUserId);
  }

  get showJoin(): boolean {
    return this.authService.authenticated && this.room &&
        !this.room.userIds.includes(this.authService.currentUserId);
  }

  get title(): string {
    if (!this.room) return 'Loading...';

    switch (this.room.status) {
      case RoomStatus.PREGAME:
        return `${this.room.name} Lobby`;
      case RoomStatus.ASSIGNING_ROLES:
        return 'Pick Spymasters';
      default:
        if (this.game) {
          switch (this.game.status) {
            case GameStatus.BLUES_TURN:
              return `Blue's Turn`;
            case GameStatus.REDS_TURN:
              return `Red's Turn`;
            case GameStatus.BLUE_WON:
              return 'Blue Wins!';
            case GameStatus.RED_WON:
              return 'Red Wins!';
            default:
              return '';
          }
        }
    }

    // fallback to the room name
    return this.room.name;
  }
}
