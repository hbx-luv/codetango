import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Clue, Game} from 'types';

@Injectable({providedIn: 'root'})
export class ClueService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  addClue(gameId: string, clue: Partial<Clue>): Promise<DocumentReference> {
    return this.afs.collection('games').doc(gameId).collection('clues').add(
        clue);
  }

  getClues(gameId: string): Observable<Clue[]> {
    return this.afs.collection<Game>('games')
        .doc(gameId)
        .collection<Clue>('clues', ref => ref.orderBy('createdAt', 'desc'))
        .valueChanges();
  }

  getCurrentClue(gameId: string): Observable<Clue|null> {
    return this.afs
      .collection<Game>('games')
      .doc(gameId)
      .collection<Clue>(
        'clues',
        ref => {
          return ref.orderBy('createdAt', 'desc')
            .limit(1);
        })
      .snapshotChanges()
      .pipe(map(clues => {
        if (!clues || !clues.length) {
          return null;
        }

        const {doc} = clues[0].payload;
        return {id: doc.id, ...doc.data()};
      }));
  }
}
