import {Component, Input} from '@angular/core';
import {shuffle} from 'lodash';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, Room, RoomStatus, Team, TileRole, User} from '../../../../types';
import {GameService} from '../../services/game.service';
import {RoomService} from '../../services/room.service';

@Component({
  selector: 'app-pregame',
  templateUrl: './pregame.component.html',
  styleUrls: ['./pregame.component.scss'],
})
export class PregameComponent {
  @Input() room: Room;
  @Input() game: Game;
  currentGame$: Observable<Game>;
  teams: Team[];
  constructedGame: Partial<Game>;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
  ) {}

  get userInRoom(): boolean {
    return this.room && this.authService.authenticated &&
        this.room.userIds.includes(this.authService.currentUserId);
  }

  get canStartGame(): boolean {
    return this.game &&
        this.game.redTeam.userIds.includes(this.game.redTeam.spymaster) &&
        this.game.blueTeam.userIds.includes(this.game.blueTeam.spymaster);
  }

  removeUser(userId: string) {
    this.roomService.removeUserFromRoom(this.room.id, userId);
  }

  async assignUsersToRandomTeams() {
    const redTeamUsers = [];
    const blueTeamUsers = [];
    const roomSize = this.room.userIds.length;
    const randomizedUsers = shuffle(this.room.userIds);

    for (let i = 0; i < roomSize; i++) {
      if (i % 2 === 0) {
        redTeamUsers.push(randomizedUsers[i]);
      } else {
        blueTeamUsers.push(randomizedUsers[i]);
      }
    }

    // wait for the game to be created
    const loader = await this.utilService.presentLoader('Creating game...');
    await this.gameService.createGame({
      createdAt: Date.now(),
      blueTeam: {
        color: TileRole.BLUE,
        userIds: blueTeamUsers,
        spymaster: blueTeamUsers[0],
      },
      redTeam: {
        color: TileRole.RED,
        userIds: redTeamUsers,
        spymaster: redTeamUsers[0],
      },
      roomId: this.room.id,
    });

    // move the room to the next state
    await this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.ASSIGNING_ROLES,
    });
    await loader.dismiss();
  }

  async startGame() {
    const loader = await this.utilService.presentLoader('Starting game...');
    await this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.GAME_IN_PROGRESS,
    });
    const timer = this.room.firstTurnTimer || this.room.timer;
    if (timer) {
      // set spymaster to the top of the list and set timer
      await this.gameService.updateGame(this.game.id, {
        'blueTeam.userIds': this.sortSpymasterFirst(this.game.blueTeam),
        'redTeam.userIds': this.sortSpymasterFirst(this.game.redTeam),
        turnEnds: Date.now() + (timer * 1000),
      });
    }
    await loader.dismiss();
  }

  sortSpymasterFirst(team: Team) {
    const {userIds, spymaster} = team;
    return userIds.sort(user => user === spymaster ? -1 : 0);
  }
}
