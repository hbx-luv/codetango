import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {GameService} from 'src/app/services/game.service';
import {Game, Room} from 'types';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  @Input() room: Room;
  @Input() game: Game;

  constructor() {}
}
