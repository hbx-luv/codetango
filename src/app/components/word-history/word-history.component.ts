import {Component, Input, OnInit} from '@angular/core';
import {tap} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {UtilService} from 'src/app/services/util.service';

import {Clue, Game} from '../../../../types';

@Component({
  selector: 'app-word-history',
  templateUrl: './word-history.component.html',
  styleUrls: ['./word-history.component.scss'],
})
export class WordHistoryComponent implements OnInit {
  @Input() game: Game;
  lastClue: Clue;
  clues$;

  constructor(
      private readonly clueService: ClueService,
      private readonly utilService: UtilService,
  ) {}

  ngOnInit() {
    this.clues$ = this.clueService.getClues(this.game.id).pipe(tap(clues => {
      const latestClue = clues[0];

      // only show the toast for new clues coming in
      if (this.lastClue) {
        this.utilService.showToast(
            `Clue from SpyMaster: ${latestClue.word} for ${
                latestClue.guessCount}`,
            10000, {
              color: this.getColor(latestClue),
              buttons: ['close'],
            });
      }
      this.lastClue = latestClue;
    }));
  }

  getColor(clue) {
    if (!clue) {
      return null;
    }
    const team = clue.team;

    switch (team) {
      case 'BLUE CLUE':
        return 'primary';
      case 'RED CLUE':
        return 'danger';
    }
  }
}
