import {Injectable} from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collection,
  collectionData,
  doc,
  DocumentReference,
  Firestore,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Clue, ClueStatus, ProposedClue, Tile} from 'types';

const CLUES_COLLECTION = 'clues';
const PROPOSED_COLLECTION = 'proposed-clues';

@Injectable({providedIn: 'root'})
export class ClueService {
  constructor(
      private readonly firestore: Firestore,
  ) {}

  addClue(gameId: string, clue: Partial<Clue>): Promise<DocumentReference> {
    return addDoc(
        collection(this.firestore, 'games', gameId, CLUES_COLLECTION), clue);
  }

  getClues(gameId: string): Observable<Clue[]> {
    const q = query(
        collection(this.firestore, 'games', gameId, CLUES_COLLECTION),
        orderBy('createdAt', 'desc'),
    );
    return collectionData(q, {idField: 'id'}) as Observable<Clue[]>;
  }

  getCurrentClue(gameId: string): Observable<Clue|null> {
    const q = query(
        collection(this.firestore, 'games', gameId, CLUES_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(1),
    );
    return collectionData(q, {idField: 'id'}).pipe(
        map(clues => (clues && clues.length ? (clues[0] as Clue) : null)),
    );
  }

  addGuessToClue(gameId: string, clueId: string, tile: Tile): Promise<void> {
    return updateDoc(
        doc(this.firestore, 'games', gameId, CLUES_COLLECTION, clueId),
        {guessesMade: arrayUnion(tile)},
    );
  }

  proposeClue(gameId: string, clue: Partial<ProposedClue>):
      Promise<DocumentReference> {
    clue.status = ClueStatus.WAITING;
    return addDoc(
        collection(this.firestore, 'games', gameId, PROPOSED_COLLECTION),
        clue);
  }

  async approveClue(gameId: string, clue: ProposedClue) {
    await this.setClueStatus(gameId, clue.id, ClueStatus.APPROVED);
    const {status: _status, id: _id, ...rest} = clue;
    return this.addClue(gameId, rest);
  }

  denyClue(gameId: string, clueId: string) {
    return this.setClueStatus(gameId, clueId, ClueStatus.DENIED);
  }

  cancelClue(gameId: string, clueId: string) {
    return this.setClueStatus(gameId, clueId, ClueStatus.CANCELED);
  }

  setClueStatus(gameId: string, clueId: string, status: ClueStatus) {
    return updateDoc(
        doc(this.firestore, 'games', gameId, PROPOSED_COLLECTION, clueId),
        {status},
    );
  }

  getProposedClue(gameId: string): Observable<ProposedClue|null> {
    const q = query(
        collection(this.firestore, 'games', gameId, PROPOSED_COLLECTION),
        where('status', '==', ClueStatus.WAITING),
        orderBy('createdAt', 'desc'),
        limit(1),
    );
    return collectionData(q, {idField: 'id'}).pipe(
        map(clues =>
                (clues && clues.length ? (clues[0] as ProposedClue) : null)),
    );
  }
}
