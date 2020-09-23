import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {UtilService} from 'src/app/services/util.service';

import {Clue, Game, TeamTypes} from '../../../../types';
import {Sound, SoundService} from '../../services/sound.service';

@Component({
  selector: 'app-word-history',
  templateUrl: './word-history.component.html',
  styleUrls: ['./word-history.component.scss'],
})
export class WordHistoryComponent implements OnInit {
  @Input() game: Game;
  clues$: Observable<Clue[]>;

  latestClue?: Clue;

  constructor(
      private readonly clueService: ClueService,
      private readonly utilService: UtilService,
      private readonly soundService: SoundService,
  ) {}

  ngOnInit() {
    this.clues$ = this.clueService.getClues(this.game.id).pipe(tap(clues => {
      const clue = clues[0] as Clue;
      const uniqueClue = this.notEqual(clue, this.latestClue);

      // toast when we have a unique clue and the game isn't over
      if (clue && uniqueClue && !this.game.completedAt) {
        // but don't toast and play sound when refreshing mid game
        if (!this.isRefreshingMidGame(clues, this.latestClue)) {
          this.soundService.play(Sound.NEW_CLUE);

          this.utilService.showToast(
              `Clue from SpyMaster: ${clue.word} for ${clue.guessCount}`, 5000,
              {
                color: this.getColor(clue),
                buttons: ['close'],
              });
        }

        this.latestClue = clues[0];
      }
    }));
  }

  isRefreshingMidGame(clues: Clue[], latestClue: Clue): boolean {
    return (clues.length > 0 && latestClue === undefined);
  }

  /**
   * Return true when either provided clue is falsey or when they both exist but
   * have different createdAt timestamps
   */
  notEqual(a: Clue, b: Clue): boolean {
    return !a || !b || a.createdAt !== b.createdAt;
  }

  /**
   * Return the Ionic color to render as the background of a given clue
   */
  getColor(clue: Clue): string {
    if (!clue) {
      return null;
    }
    switch (clue.team) {
      case TeamTypes.BLUE:
        return 'primary';
      case TeamTypes.RED:
        return 'danger';
      default:
        return '';
    }
  }
}
