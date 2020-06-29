import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';

import {Game, GameStatus} from '../../../../types';

@Component({
  selector: 'app-clues',
  templateUrl: './clues.component.html',
  styleUrls: ['./clues.component.scss'],
})
export class CluesComponent implements OnInit, OnDestroy {
  private destroyed = new ReplaySubject<never>();

  @Input() game: Game;
  @Input() isMyTurn: boolean;

  clue: string;
  clueCount: number;
  clues = [];

  constructor(
      private readonly clueService: ClueService,
  ) {}

  ngOnInit() {
    this.clueService.getClues(this.game.id)
        .pipe(takeUntil(this.destroyed))
        .subscribe(clues => {
          this.clues = clues;
        });
  }

  get currentClue() {
    return this.clues.filter(clue => clue.team === this.currentTeam())[0];
  }

  getColor(clue) {
    let team;

    if (!clue) {
      team = this.currentTeam();
    } else {
      team = clue.team;
    }

    switch (team) {
      case 'BLUE CLUE':
        return 'blue';
      case 'RED CLUE':
        return 'red';
    }
  }

  currentTeam() {
    switch (this.game.status) {
      case GameStatus.BLUES_TURN:
        return 'BLUE CLUE';
      case GameStatus.REDS_TURN:
        return 'RED CLUE';
      default:
        return 'Game Over';
    }
  }

  async submitClue() {
    const clue = this.clue != null ? this.clue.toUpperCase() : null;

    this.clueService.addClue(this.game.id, {
      word: clue,
      guessCount: this.clueCount,
      createdAt: Date.now(),
      team: this.currentTeam(),
    });

    this.clue = null;
    this.clueCount = null;
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
