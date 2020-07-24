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
  timeout: any; // NodeJS.Timeout;

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
  }

  calculateClock() {
    if (!this.game.completedAt && this.game.turnEnds) {
      this.seconds = (this.game.turnEnds - Date.now()) / 1000;
      this.clock = this.fancyTimeFormat(this.seconds);

      if (this.seconds <= 0 && this.room.enforceTimer) {
        this.gameService.updateGame(this.game.id, {
          status: this.game.status === GameStatus.BLUES_TURN ? GameStatus.REDS_TURN : GameStatus.BLUES_TURN,
          turnEnds: Date.now() + (this.room.timer * 1000)
        });
      }

      // determine the amount of time to the end of the second
      const timeToWait = 1000 - (Date.now() % 1000);
      this.timeout = setTimeout(this.calculateClock.bind(this), timeToWait);
    }
  }

  fancyTimeFormat(seconds: number) {
    if (seconds <= 0) {
      return '0:00';
    }

    // Hours, minutes and seconds
    var hrs = ~~(seconds / 3600);
    var mins = ~~((seconds % 3600) / 60);
    var secs = ~~seconds % 60;

    // Output like '1:01' or '4:03:59' or '123:03:59'
    var ret = '';

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
