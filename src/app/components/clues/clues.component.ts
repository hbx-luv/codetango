import {Component, Input, OnDestroy} from '@angular/core';
import {AlertController} from '@ionic/angular';
import {ReplaySubject} from 'rxjs';
import {ClueService} from 'src/app/services/clue.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, GameStatus, TeamTypes} from '../../../../types';

const TOAST_DURATION = 8000;
const TOAST_OPTIONS = {
  buttons: ['got it']
};

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
      private readonly utilService: UtilService,
  ) {}

  async submitClue() {
    // Need to check if the clue is valid before submitting
    if (this.disableSubmitButton) {
      this.sendWittyToast();
    } else {
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
        !!this.clue && this.clue.trim().length;
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

  sendWittyToast() {
    // fallback
    let message =
        'Something went wrong. Double check that your clue is valid and that it\'s your turn.';

    // handle validation
    if (!this.isMyTurn) {
      message =
          'It\'s not your turn! I know the other team is taking forreeveeerrrr, but they\'ll mess up soon, I promise.';
    } else if (this.currentClueIsFromMyTeam) {
      message =
          'You already gave your team a clue! Now just sit back, relax, and scream at your computer screen while they discuss clicking on the assassin.';
    } else if (!this.clue || !this.clue.trim().length) {
      message =
          'You are very return-key-happy. Try again after you have typed a clue.';
    } else if (!this.clueCount && this.clueCount !== 0) {
      message =
          'Nice clue! Now give your team some idea of how many tiles you want them to click on!';
    }

    return this.utilService.showToast(message, TOAST_DURATION, TOAST_OPTIONS);
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
