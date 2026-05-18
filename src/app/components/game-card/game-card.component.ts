import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {DateTime} from 'luxon';
import {Game, GameStatus} from 'types';

@Component({
  standalone: false,
  selector: 'app-game-card',
  templateUrl: './game-card.component.html',
  styleUrls: ['./game-card.component.scss'],
})
export class GameCardComponent implements OnInit {
  @Input() game: Game;
  @Input() showRoom = false;
  completedAtDateTime: DateTime;

  constructor(
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.completedAtDateTime = DateTime.fromMillis(this.game.completedAt);
  }

  get blueWon(): boolean {
    return this.game && this.game.status === GameStatus.BLUE_WON;
  }

  get assassin(): boolean {
    return this.game && this.game.blueAgents > 0 && this.game.redAgents > 0;
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

    const completedDay = this.completedAtDateTime.startOf('day');
    const days = Math.floor(
        DateTime.local().startOf('day').diff(completedDay, 'days').days);

    if (this.completedAtDateTime) {
      time = this.completedAtDateTime.toFormat('h:mma');

      // relative times
      if (days === 0) {
        date = 'Today';
        time = this.completedAtDateTime.toRelative() ?? time;
      } else if (days === 1) {
        date = 'Yesterday';
      } else if (days > 1 && days < 7) {
        date = this.completedAtDateTime.toFormat('cccc');
      } else {
        date = this.completedAtDateTime.toFormat('cccc, LLL d');
      }

      // dates a year in the past should include year to be more clear
      if (days >= 365) {
        date += ` ${this.completedAtDateTime.toFormat('yyyy')}`;
      }
    }

    return {date, time};
  }

  get assassinExplanation(): string {
    const color = this.game.status === GameStatus.BLUE_WON ? 'red' : 'blue';
    return `This game ended because the ${
        color} team made contact with the assassin`;
  }

  gameClicked() {
    this.router.navigate([this.game.roomId, 'games', this.game.id]);
  }

  goToRoom($event) {
    $event.stopPropagation();
    this.router.navigate(['/', this.game.roomId, 'games']);
  }
}
