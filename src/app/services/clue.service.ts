import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {default as firebase} from 'firebase';
import {omit} from 'lodash';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Clue, ClueStatus, Game, ProposedClue, Tile} from 'types';

const CLUES_COLLECTION = 'clues';
const PROPOSED_COLLECTION = 'proposed-clues';

@Injectable({providedIn: 'root'})
export class ClueService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  addClue(gameId: string, clue: Partial<Clue>): Promise<DocumentReference> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection(CLUES_COLLECTION)
        .add(clue);
  }

  getClues(gameId: string): Observable<Clue[]> {
    return this.afs.collection<Game>('games')
        .doc(gameId)
        .collection<Clue>(
            CLUES_COLLECTION, ref => ref.orderBy('createdAt', 'desc'))
        .valueChanges();
  }

  getCurrentClue(gameId: string): Observable<Clue|null> {
    return this.afs.collection<Game>('games')
        .doc(gameId)
        .collection<Clue>(
            CLUES_COLLECTION,
            ref => {
              return ref.orderBy('createdAt', 'desc').limit(1);
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

  addGuessToClue(gameId: string, clueId: string, tile: Tile): Promise<void> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection(CLUES_COLLECTION)
        .doc(clueId)
        .update({guessesMade: firebase.firestore.FieldValue.arrayUnion(tile)});
  }

  proposeClue(gameId: string, clue: Partial<ProposedClue>):
      Promise<DocumentReference> {
    clue.status = ClueStatus.WAITING;
    return this.afs.collection('games')
        .doc(gameId)
        .collection(PROPOSED_COLLECTION)
        .add(clue);
  }

  async approveClue(gameId: string, clue: ProposedClue) {
    await this.setClueStatus(gameId, clue.id, ClueStatus.APPROVED);
    return this.addClue(gameId, omit(clue, ['status', 'id']));
  }

  denyClue(gameId: string, clueId: string) {
    return this.setClueStatus(gameId, clueId, ClueStatus.DENIED);
  }

  cancelClue(gameId: string, clueId: string) {
    return this.setClueStatus(gameId, clueId, ClueStatus.CANCELED);
  }

  setClueStatus(gameId: string, clueId: string, status: ClueStatus) {
    return this.afs.collection('games')
        .doc(gameId)
        .collection(PROPOSED_COLLECTION)
        .doc(clueId)
        .update({status});
  }

  getProposedClue(gameId: string): Observable<ProposedClue|null> {
    return this.afs.collection<Game>('games')
        .doc(gameId)
        .collection<ProposedClue>(
            PROPOSED_COLLECTION,
            ref => {
              return ref.orderBy('createdAt', 'desc')
                  .where('status', '==', ClueStatus.WAITING)
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
