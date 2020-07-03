import {Component, Input} from '@angular/core';
import * as moment from 'moment';
import {Game, GameStatus} from 'types';

@Component({
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrls: ['./game-card.component.scss'],
})
export class GameCardComponent {
  @Input() game: Game;

  constructor() {}

  get status(): {text: string, color: string} {
    let text = '';
    let color = '';

    if (this.game) {
      switch (this.game.status) {
        case GameStatus.BLUES_TURN:
          text = `Blue's Turn`;
          color = 'primary';
          break;
        case GameStatus.REDS_TURN:
          text = `Red's Turn`;
          color = 'danger';
          break;
        case GameStatus.BLUE_WON:
          text = 'Blue Wins!';
          color = 'primary';
          break;
        case GameStatus.RED_WON:
          text = 'Red Wins!';
          color = 'danger';
          break;
        default:
          break;
      }
    }

    return {text, color};
  }

  get completedAt(): {date: string, time: string} {
    const completedMoment = moment(this.game.completedAt);
    return {
      date: completedMoment.format('dddd, MMM D'),
      time: completedMoment.format('h:mma'),
    };
  }
}
