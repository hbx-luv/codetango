import {Component, Input, OnInit} from '@angular/core';
import {Game, GameStatus, Room, RoomStatus} from '../../../../types';
import {AuthService} from '../../services/auth.service';
import * as firebase from 'firebase';
import {GameService} from '../../services/game.service';

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
    private readonly gameService: GameService,
  ) { }

  ngOnInit() {}

  get showJoinGameButton(): boolean {
    if (!this.gameInProgress) {
      return true;
    }
    if (this.loggedInUserTeam == null) {
      return true;
    }
    return false;
  }

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
  get loggedInUserIsSpyMaster(): boolean {
    const userId = this.loggedInUser.uid;
    return this.game && (this.game.redTeam.spymaster === userId || this.game.blueTeam.spymaster === userId);
  }

  get loggedInUserDisplayName(): string {
    if (this.loggedInUserIsSpyMaster) {
      return `🕵 ${this.loggedInUser.displayName}`;
    }
    return this.loggedInUser.displayName;
  }

  get loggedInUserTeam(): string {
    if (this.loggedInUser) {
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
    return null;
  }

  logout() {
    if (this.loggedInUserTeam === 'RED') {
      this.gameService.removePlayerRedTeam(this.game, this.authService.currentUserId);
    } else if (this.loggedInUserTeam === 'BLUE') {
      this.gameService.removePlayerBlueTeam(this.game, this.authService.currentUserId);
    }
    this.gameService.updateGame(this.game.id, this.game);
    this.authService.logout();
  }

}
