import {Component, Input, OnInit} from '@angular/core';
import {Game, GameStatus, Room, RoomStatus} from '../../../../types';
import {AuthService} from '../../services/auth.service';
import * as firebase from 'firebase';

@Component({
  selector: 'app-title-bar',
  templateUrl: './title-bar.component.html',
  styleUrls: ['./title-bar.component.scss'],
})
export class TitleBarComponent implements OnInit {
  @Input() room: Room;
  @Input() game: Game;

  constructor(
    private readonly authService: AuthService,
  ) { }

  ngOnInit() {}

  get gameInProgress(): boolean {
    return this.room && [
      RoomStatus.GAME_IN_PROGRESS,
      RoomStatus.GAME_ENDED,
    ].includes(this.room.status);
  }

  get loggedInUser(): firebase.User {
    if (this.authService.authenticated) {
      return this.authService.currentUser;
    }
  }

  get loggedInUserDisplayName(): string {
    return this.loggedInUser.displayName;
  }

  get loggedInUserTeam(): string {
    const currentUserId = this.loggedInUser.uid;
    if (!this.game) {
      return null;
    }
    if (this.game.blueTeam.userIds.includes(currentUserId)){
      return 'BLUE';
    }
    if (this.game.redTeam.userIds.includes(currentUserId)){
      return 'RED';
    }
    return null;
  }

  get showJoin(): boolean {
    return this.authService.authenticated && this.room &&
      !this.room.userIds.includes(this.authService.currentUserId);
  }

  get displayedGameStatus(): string {
    if (this.game) {
      switch (this.game.status) {
        case GameStatus.BLUES_TURN:
          return `Blue's Turn`;
        case GameStatus.REDS_TURN:
          return `Red's Turn`;
        case GameStatus.BLUE_WON:
          return 'BLUE WON';
        case GameStatus.RED_WON:
          return 'RED WON';
      }
      return this.game.status;
    }
    return 'BROKEN';
  }

}
