import {Component, Input} from '@angular/core';
import {Game, GameStatus, Room} from 'types';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss'],
})
export class TimerComponent {
  @Input() room: Room;
  @Input() game: Game;

  clock = '';
  seconds: number;
  timeout: any;  // NodeJS.Timeout;

  timerTooltip: string;

  constructor(private readonly gameService: GameService) {}

  get color(): string {
    if (this.seconds <= 10) {
      return 'danger';
    } else if (this.seconds <= 30) {
      return 'warning';
    } else {
      return 'dark';
    }
  }

  ngOnChanges() {
    if (this.game && this.game.createdAt && !this.timeout) {
      this.calculateClock();
    }
    if (this.room) {
      this.timerTooltip = this.room.enforceTimer ?
          'When the timer runs out, the turn will automaticlly be ended.' :
          'The timer here is just a suggestion, nothing will happen when the timer runs out.';
    } else {
      this.timerTooltip = 'The time remaining on the clock';
    }
  }

  calculateClock() {
    const {completedAt, turnEnds} = this.game;

    // if the turn is meant to end at some time, show the timer
    if (turnEnds) {
      // the timer is relative to when the game was completed for finished games
      const timerRelativeTo = completedAt || Date.now();
      this.seconds = (turnEnds - timerRelativeTo) / 1000;
      this.clock = this.fancyTimeFormat(this.seconds);

      // TODO: re-implement enforceTimer in a way that ensures the turn is only
      // ended once
      if (this.seconds <= 0 && this.room.enforceTimer && !completedAt) {
        this.gameService.updateGame(this.game.id, {
          status: this.game.status === GameStatus.BLUES_TURN ?
              GameStatus.REDS_TURN :
              GameStatus.BLUES_TURN,
          turnEnds: Date.now() + (this.room.timer * 1000)
        });
      }

      // if the game isn't completed, update the timer in about a second
      if (!completedAt) {
        // determine the amount of time to the end of the second
        const timeToWait = 1000 - (Date.now() % 1000);
        this.timeout = setTimeout(this.calculateClock.bind(this), timeToWait);
      }
    }
  }

  fancyTimeFormat(seconds: number) {
    if (seconds <= 0) {
      return '0:00';
    }

    // Hours, minutes and seconds
    const hrs = ~~(seconds / 3600);
    const mins = ~~((seconds % 3600) / 60);
    const secs = ~~seconds % 60;

    // Output like '1:01' or '4:03:59' or '123:03:59'
    let ret = '';

    if (hrs > 0) {
      ret += '' + hrs + ':' + (mins < 10 ? '0' : '');
    }

    ret += '' + mins + ':' + (secs < 10 ? '0' : '');
    ret += '' + secs;
    return ret;
  }

  ngOnDestroy() {
    clearTimeout(this.timeout);
  }
}
