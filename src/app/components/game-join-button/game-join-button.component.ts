import {Component, Input} from '@angular/core';
import {Router} from '@angular/router';
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
      private readonly router: Router,
  ) {}

  get loggedIn(): boolean {
    return this.room && this.authService.authenticated;
  }

  get showLogin(): boolean {
    return !this.loggedIn;
  }

  get userIsInRoom(): boolean {
    return this.room.userIds.includes(this.authService.currentUserId);
  }

  get showJoin(): boolean {
    return this.loggedIn && !this.userIsInRoom;
  }

  get showLeave(): boolean {
    return this.loggedIn && this.userIsInRoom;
  }

  login() {
    this.authService.loginWithGoogle();
  }

  join() {
    this.roomService.joinRoom(this.room.id);
  }

  leave() {
    // remove them from the room
    this.roomService.removeUserFromRoom(
        this.room.id,
        this.authService.currentUserId,
    );
    // remove them from the game, so long as it hasn't already completed
    if (!this.game.completedAt) {
      this.gameService.removePlayerFromGame(
          this.game.id,
          this.authService.currentUserId,
      );
    }
    // go home
    this.router.navigate(['']);
  }
}
