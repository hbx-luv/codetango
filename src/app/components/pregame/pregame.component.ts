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
  @Input() user: User;
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

    const redTeam = {color: TileRole.RED, userIds: redTeamUsers};
    const blueTeam = {color: TileRole.BLUE, userIds: blueTeamUsers};
    this.roomService.updateRoom(this.room.id, {status: RoomStatus.ASSIGNING_ROLES});
    this.gameService.createGame({
      createdAt: Date.now(),
      blueTeam,
      redTeam,
      roomId: this.room.id
    });
  }
  assignRedSpymaster(userId: string) {
    this.gameService.updateGame(this.game.id, {redTeam: {spymaster: userId} });
  }

  // assignUserToInProgressGame() {
  //   const userAlreadyOnBlue = this.currentGame.blueTeam.userIds.includes(this.user.id);
  //   const userAlreadyOnRed = this.currentGame.redTeam.userIds.includes(this.user.id);
  //
  //   const redTeamCount = this.currentGame.redTeam.userIds.length;
  //   const blueTeamCount = this.currentGame.blueTeam.userIds.length;
  //   if (!userAlreadyOnRed && !userAlreadyOnBlue) {
  //     if (redTeamCount < blueTeamCount) {
  //       this.addUserToRedTeam();
  //     } else if (blueTeamCount < redTeamCount) {
  //       this.addUserToBlueTeam();
  //     } else {
  //       this.addUserToRandomTeam();
  //     }
  //     this.gameService.updateGame(this.currentGame.id, this.currentGame);
  //   }
  // }
  // addUserToBlueTeam() {
  //   this.currentGame.blueTeam.userIds.push(this.user.id);
  // }
  // addUserToRedTeam() {
  //   this.currentGame.redTeam.userIds.push(this.user.id);
  // }
  // addUserToRandomTeam() {
  //   // Random number 1 - 100
  //   const randomNum = Math.floor(Math.random() * 100) + 1;
  //   if (randomNum % 2 === 0) {
  //     this.addUserToRedTeam();
  //   } else {
  //     this.addUserToBlueTeam();
  //   }
  // }
}
