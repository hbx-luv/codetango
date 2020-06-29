import {Component, Input, OnInit} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';

import {Clue, Game, GameStatus, WordList} from '../../../../types';

@Component({
  selector: 'app-clues',
  templateUrl: './clues.component.html',
  styleUrls: ['./clues.component.scss'],
})
export class CluesComponent implements OnInit {
  @Input() game: Game;
  @Input() isMyTurn: boolean;

  constructor(private afs: AngularFirestore) {}

  clue: string;
  clueCount: number;
  clues = [];

  get currentClue() {
    return this.clues.filter(clue => clue.team === this.currentTeam())[0];
  }

  ngOnInit() {
    this.getClues().subscribe(clue => {
      this.clues.push(clue);
    });
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
    const clueDto = {
      word: clue,
      guessCount: this.clueCount,
      createdAt: Date.now(),
      team: this.currentTeam()
    };

    await this.afs.collection('games')
        .doc(this.game.id)
        .collection('clues')
        .add(clueDto);

    this.clue = null;
    this.clueCount = null;
  }

  getClues(): Observable<Clue[]> {
    return this.afs.collection<Game>('games')
        .doc(this.game.id)
        .collection<Clue>(
            'clues',
            ref => {
              return ref.orderBy('createdAt', 'desc');
            })
        .valueChanges()
        .pipe(tap(clues => {
          this.clues = clues;
        }));
  }

  get submitClueButtonText(): string {
    return this.isMyTurn ? 'Submit' : 'Waiting for Other Team';
  }
}
