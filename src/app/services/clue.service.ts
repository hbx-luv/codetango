import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
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
}
