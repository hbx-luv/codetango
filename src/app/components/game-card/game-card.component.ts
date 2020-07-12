import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import * as moment from 'moment';
import {Game, GameStatus} from 'types';

@Component({
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrls: ['./game-card.component.scss'],
})
export class GameCardComponent implements OnInit {
  @Input() game: Game;
  completedMoment: moment.Moment;

  constructor(
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.completedMoment = moment(this.game.completedAt);
  }

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
    let date = '';
    let time = '';

    if (this.completedMoment) {
      date = this.completedMoment.format('dddd, MMM D');
      time = this.completedMoment.format('h:mma');
    }

    return {date, time};
  }

  gameClicked() {
    this.router.navigate([this.game.roomId, 'games', this.game.id]);
  }
}
