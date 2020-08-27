import {Component, Input, OnDestroy} from '@angular/core';
import {AlertController} from '@ionic/angular';
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
  @Input() currentClueIsFromMyTeam: boolean;

  clue: string;
  clueCount: number;

  constructor(
      private readonly clueService: ClueService,
      private readonly alertController: AlertController,
  ) {}

  async submitClue() {
    // Need to check if the clue is valid before submitting
    if (!this.disableSubmitButton) {
      if (await this.isClueIllegalWord(this.clue)) {
        return;
      }

      const clue = this.clue != null ? this.clue.toUpperCase() : null;
      const isBluesTurn = GameStatus.BLUES_TURN === this.game.status;

      this.clueService.addClue(this.game.id, {
        word: clue,
        guessCount: this.getGuessCount(this.clueCount),
        maxGuesses: this.clueCount === 0 ? 999 : this.clueCount + 1,
        guessesMade: [],
        createdAt: Date.now(),
        team: isBluesTurn ? TeamTypes.BLUE : TeamTypes.RED,
      });

      this.clue = null;
      this.clueCount = null;
    }
  }

  async isClueIllegalWord(clue: string) {
    clue = clue.toUpperCase().trim();

    // Some clue tiles are 2 words - match those exactly?
    let illegalWord =
        this.game.tiles.find(tile => tile.word.toUpperCase().trim() === clue);

    if (!illegalWord) {
      // Check each individual word against the game tiles
      const allWordsInClue = clue.split(' ');

      allWordsInClue.some(individualWord => {
        illegalWord = this.game.tiles.find(
            tile => tile.word.toUpperCase().trim() === individualWord);
        if (illegalWord) {
          return true;
        }
      });
    }

    if (illegalWord) {
      const alert = await this.alertController.create({
        header: 'Try again',
        message: `${
            illegalWord
                .word} is on the board, so you need to give a different clue!`,
        buttons: ['OK']
      });
      await alert.present();
    }

    return !!illegalWord;
  }

  get disableSubmitButton(): boolean {
    // this.clueCount >= 0 didn't work when I put a number and then deleted the
    // number
    const hasAClue = (this.clueCount === 0 || this.clueCount > 0) &&
        this.clue !== undefined && this.clue.trim().length;
    return !hasAClue || !this.isMyTurn || this.currentClueIsFromMyTeam;
  }

  getGuessCount(clueCount: number): string {
    if (clueCount < 0) {
      return '0';
    } else if (clueCount > 9) {
      return '∞'
    } else {
      return clueCount.toFixed(0);
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
