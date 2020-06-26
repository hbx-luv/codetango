import {Component, Input, OnInit} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Clue, Game, GameStatus, WordList} from '../../../../types';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'app-clues',
  templateUrl: './clues.component.html',
  styleUrls: ['./clues.component.scss'],
})
export class CluesComponent implements OnInit {

  @Input() game: Game;

  constructor(
      private afs: AngularFirestore
  ) {}

  clue: string;
  clueCount: number;
  clues = [];

  get currentClue() {
    return this.clues[0];
  }

  ngOnInit() {
    this.getClues().subscribe(clue => {
      this.clues.push(clue);
    });
  }

  currentTeam() {
    switch (this.game.status) {
      case GameStatus.BLUES_TURN:
        return 'BLUE CLUE:';
      case GameStatus.REDS_TURN:
        return 'RED CLUE';
      default:
        return 'Game Over';
    }
  }

  async submitClue() {
    const clueDto = {
      word: this.clue,
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
    return this.afs
        .collection<Game>('games')
        .doc(this.game.id)
        .collection<Clue>('clues')
        .valueChanges()
        .pipe(tap(clues => {
          this.clues = clues;
        }));
  }
}
