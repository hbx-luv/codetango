import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {UtilService} from 'src/app/services/util.service';

import {Clue, Game, TileRole} from '../../../../types';

@Component({
  selector: 'app-word-history',
  templateUrl: './word-history.component.html',
  styleUrls: ['./word-history.component.scss'],
})
export class WordHistoryComponent implements OnInit {
  @Input() game: Game;
  clues$: Observable<Clue[]>;

  constructor(
      private readonly clueService: ClueService,
      private readonly utilService: UtilService,
  ) {}

  ngOnInit() {
    this.clues$ = this.clueService.getClues(this.game.id).pipe(tap(clues => {
      const latestClue = clues[0];
      if (latestClue && !this.game.completedAt) {
        this.utilService.showToast(
            `Clue from SpyMaster: ${latestClue.word} for ${
                latestClue.guessCount}`,
            5000, {
              color: this.getColor(latestClue),
              buttons: ['close'],
            });
      }
    }));
  }

  getColor(clue) {
    if (!clue) {
      return null;
    }
    switch (clue.team) {
      case TileRole.BLUE:
        return 'primary';
      case TileRole.RED:
        return 'danger';
      default:
        return '';
    }
  }
}
