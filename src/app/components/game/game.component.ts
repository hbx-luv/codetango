import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {Game, Room} from 'types';

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
  ) {}

  get playingInGame(): boolean {
    // TODO: also check that the user is actually playing the game
    return this.authService.authenticated;
  }

  get spymaster(): boolean {
    // TODO: also check that the user is actually playing the game and is the
    // spymaster role
    return this.playingInGame;
  }
}
