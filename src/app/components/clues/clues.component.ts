import {Component, Input, OnDestroy} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {ClueService} from 'src/app/services/clue.service';

import {Game, GameStatus, TeamTypes, TileRole} from '../../../../types';
import {AlertController} from '@ionic/angular';

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
      private readonly alertController: AlertController,
  ) {}

  async submitClue() {
    // Need to check if the clue is valid before submitting
    if (!this.disableSubmitButton) {
      if (await this.isClueIllegalWord(this.clue)) {
        return;
      }

      if (await this.isClueCountTooHigh(this.clueCount)) {
        return;
      }

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

  async isClueIllegalWord(clue: string) {
    clue = clue.toUpperCase().trim();

    // Some clue tiles are 2 words - match those exactly?
    let illegalWord = this.game.tiles.find(tile => tile.word.toUpperCase().trim() === clue);

    if (!illegalWord) {
      // Check each individual word against the game tiles
      const allWordsInClue = clue.split(' ');

      allWordsInClue.some(individualWord => {
        illegalWord = this.game.tiles.find(tile => tile.word.toUpperCase().trim() === individualWord);
        if (illegalWord) {
          return true;
        }
      });
    }

    if (illegalWord){
      const alert = await this.alertController.create({
        header: 'Try again',
        message: `${illegalWord.word} is on the board, so you need to give a different clue!`,
        buttons: ['OK']
      });
      await alert.present();
    }

    return !!illegalWord;
  }

  async isClueCountTooHigh(clueCount: number) {
    if (clueCount > 999) {
      // You cannot use a word that's on the board
      const alert = await this.alertController.create({
        header: 'Try again',
        message: `Clues must be lower than 1,000!`,
        buttons: ['OK']
      });
      await alert.present();
      return true;
    }
    return false;
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
