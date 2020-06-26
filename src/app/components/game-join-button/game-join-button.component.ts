import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {Room} from 'types';

@Component({
  selector: 'app-game-join-button',
  templateUrl: './game-join-button.component.html',
  styleUrls: ['./game-join-button.component.scss'],
})
export class GameJoinButtonComponent {
  @Input() room: Room;

  constructor(
      private readonly authService: AuthService,
      private readonly roomService: RoomService,
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
}
