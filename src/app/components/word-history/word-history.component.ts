import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {Clue, Game} from '../../../../types';
import {tap} from 'rxjs/operators';
import {AngularFirestore} from '@angular/fire/firestore';

@Component({
  selector: 'app-word-history',
  templateUrl: './word-history.component.html',
  styleUrls: ['./word-history.component.scss'],
})
export class WordHistoryComponent implements OnInit {
  @Input() game: Game;
  clues = [];

  constructor(
    private afs: AngularFirestore
  ) { }

  ngOnInit() {
    this.getClues().subscribe(clue => {
      this.clues.push(clue);
    });
  }

  getColor(clue) {
    if (!clue) {
      return null;
    }
    const team = clue.team;

    switch (team) {
      case 'BLUE CLUE':
        return 'blue';
      case 'RED CLUE':
        return 'red';
    }
  }

  getClues(): Observable<Clue[]> {
    return this.afs
      .collection<Game>('games')
      .doc(this.game.id)
      .collection<Clue>(
        'clues',
        ref => {
          return ref
            .orderBy('createdAt', 'desc');
        }
      )
      .valueChanges()
      .pipe(tap(clues => {
        this.clues = clues;
      }));
  }

}
