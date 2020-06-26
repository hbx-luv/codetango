import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {Game, GameStatus, Room} from 'types';

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
      private readonly gameService: GameService
  ) {}

  get playingInGame(): boolean {
    // TODO: also check that the user is actually playing the game
    return true //this.authService.authenticated;
  }

  get spymaster(): boolean {
    // TODO: also check that the user is actually playing the game and is the
    // spymaster role
    return this.playingInGame;
  }

  endCurrentTeamsTurn() {
    let turnToSet = GameStatus.REDS_TURN;

    if (this.game.status === GameStatus.REDS_TURN) {
      turnToSet = GameStatus.BLUES_TURN;
    }

    this.gameService.updateGame(this.game.id, {
      status: turnToSet
    });
  }
}
