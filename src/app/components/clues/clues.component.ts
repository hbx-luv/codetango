import {Component, Input, OnDestroy} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {ClueService} from 'src/app/services/clue.service';

import {Game, GameStatus, TeamTypes, TileRole} from '../../../../types';

@Component({
  selector: 'app-clues',
  templateUrl: './clues.component.html',
  styleUrls: ['./clues.component.scss'],
})
export class CluesComponent implements OnDestroy {
  private destroyed = new ReplaySubject<never>();

  @Input() game: Game;
  @Input() isMyTurn: boolean;

  clue: string;
  clueCount: number;

  constructor(
      private readonly clueService: ClueService,
  ) {}

  async submitClue() {
    // Need to check if the clue is valid before submitting
    if (!this.disableSubmitButton) {
      const clue = this.clue != null ? this.clue.toUpperCase() : null;
      const isBluesTurn = GameStatus.BLUES_TURN === this.game.status;

      this.clueService.addClue(this.game.id, {
        word: clue,
        guessCount: this.clueCount,
        createdAt: Date.now(),
        team: isBluesTurn ? TeamTypes.BLUE : TeamTypes.RED,
      });

      this.clue = null;
      this.clueCount = null;
    }
  }

  get submitClueButtonText(): string {
    return this.isMyTurn ? 'Submit' : 'Waiting for Other Team';
  }

  get disableSubmitButton(): boolean {
    // this.clueCount >= 0 didn't work when I put a number and then deleted the
    // number
    const hasAClue = (this.clueCount === 0 || this.clueCount > 0) &&
        this.clue !== undefined && this.clue.trim().length;
    return !hasAClue || !this.isMyTurn;
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
