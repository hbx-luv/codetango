import {Component, Input, OnInit} from '@angular/core';
import * as _ from 'lodash';
import {Observable} from 'rxjs';

import {Game, Room, RoomStatus, Team, TileRole, User} from '../../../../types';
import {GameService} from '../../services/game.service';
import {RoomService} from '../../services/room.service';

@Component({
  selector: 'app-pregame',
  templateUrl: './pregame.component.html',
  styleUrls: ['./pregame.component.scss'],
})
export class PregameComponent implements OnInit {
  @Input() room: Room;
  @Input() game: Game;
  currentGame$: Observable<Game>;
  teams: Team[];
  constructedGame: Partial<Game>;

  constructor(
      private readonly gameService: GameService,
      private readonly roomService: RoomService) {}

  ngOnInit() {}

  assignUsersToRandomTeams() {
    const redTeamUsers = [];
    const blueTeamUsers = [];
    const roomSize = this.room.userIds.length;
    const randomizedUsers = _.shuffle(this.room.userIds);

    for (let i = 0; i < roomSize; i++) {
      if (i % 2 === 0) {
        redTeamUsers.push(randomizedUsers[i]);
      } else {
        blueTeamUsers.push(randomizedUsers[i]);
      }
    }

    // kick off the game creation
    this.gameService.createGame({
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
    this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.ASSIGNING_ROLES,
    });
  }

  startGame() {
    this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.GAME_IN_PROGRESS,
    });
  }
}
