import {Component, Input} from '@angular/core';
import {get} from 'lodash';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {UtilService} from 'src/app/services/util.service';
import {Game, GameStatus, Room, RoomStatus} from 'types';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  @Input() room: Room;
  @Input() game: Game;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
  ) {}

  get readonly(): boolean {
    return !this.game || !!this.game.completedAt || !this.myTurn;
  }

  get myTurn(): boolean {
    const {currentUserId} = this.authService;
    return get(this.game, 'redTeam.userIds').includes(currentUserId) &&
        get(this.game, 'status') === GameStatus.REDS_TURN ||
        get(this.game, 'blueTeam.userIds').includes(currentUserId) &&
        get(this.game, 'status') === GameStatus.BLUES_TURN;
  }

  get spymaster(): boolean {
    const {currentUserId} = this.authService;
    return get(this.game, 'redTeam.spymaster') === currentUserId ||
        get(this.game, 'blueTeam.spymaster') === currentUserId;
  }

  endCurrentTeamsTurn() {
    const updates: Partial<Game> = {};

    if (this.game.status === GameStatus.REDS_TURN) {
      updates.status = GameStatus.BLUES_TURN;
    } else {
      updates.status = GameStatus.REDS_TURN;
    }

    // set the timer if one exists
    if (this.room.timer) {
      updates.turnEnds = Date.now() + (this.room.timer * 1000);
    }

    this.gameService.updateGame(this.game.id, updates);
  }

  async backToLobby() {
    const loader = await this.utilService.presentLoader('Redirecting...');
    await this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.PREGAME,
    });
    await loader.dismiss();
  }

  async nextGame() {
    const loader =
        await this.utilService.presentLoader('Creating the next game...');
    const {redTeam, blueTeam, roomId} = this.game;
    await this.gameService.createGame({redTeam, blueTeam, roomId});
    await this.roomService.updateRoom(
        roomId, {status: RoomStatus.ASSIGNING_ROLES});
    await loader.dismiss();
  }
}
