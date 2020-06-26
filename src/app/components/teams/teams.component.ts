import {Component, Input, OnInit} from '@angular/core';
import {Game, GameStatus, Room, User} from '../../../../types';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
})
export class TeamsComponent implements OnInit {
  @Input() user: User;
  @Input() room: Room;
  @Input() currentGame: Game;

  constructor(
      private readonly gameService: GameService,
  ) { }

  ngOnInit() {
    this.assignTeams();
  }

  assignTeams() {
    const userAlreadyOnBlue = this.currentGame.blueTeam.userIds.includes(this.user.id);
    const userAlreadyOnRed = this.currentGame.redTeam.userIds.includes(this.user.id);

    const redTeamCount = this.currentGame.redTeam.userIds.length;
    const blueTeamCount = this.currentGame.blueTeam.userIds.length;
    if (!userAlreadyOnRed && !userAlreadyOnBlue) {
      if (redTeamCount < blueTeamCount) {
        this.addUserToRedTeam();
      } else if (blueTeamCount < redTeamCount) {
        this.addUserToBlueTeam();
      } else {
        this.addUserToRandomTeam();
      }
      this.gameService.updateGame(this.currentGame.id, this.currentGame);
    }
  }
  addUserToBlueTeam() {
    this.currentGame.blueTeam.userIds.push(this.user.id);
  }
  addUserToRedTeam() {
    this.currentGame.redTeam.userIds.push(this.user.id);
  }
  addUserToRandomTeam() {
    // Random number 1 - 100
    const randomNum = Math.floor(Math.random() * 100) + 1;
    if (randomNum % 2 === 0) {
      this.addUserToRedTeam();
    } else {
      this.addUserToBlueTeam();
    }
  }
}
