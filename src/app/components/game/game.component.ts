import {Component, Input, OnInit} from '@angular/core';
import {GameService} from 'src/app/services/game.service';
import {Room} from 'types';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  @Input() room: Room;

  constructor(
      private readonly gameService: GameService,
  ) {}
}
