import {Injectable} from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {User} from 'types';

@Injectable({providedIn: 'root'})
export class LeaderboardService {
  constructor(
      private readonly firestore: Firestore,
  ) {}

  getLeaderboard(roomId: string): Observable<User[]> {
    const q = query(
        collection(this.firestore, 'users'),
        where('rooms', 'array-contains', roomId),
        orderBy('stats.elo', 'desc'),
    );
    return collectionData(q, {idField: 'id'}) as Observable<User[]>;
  }
}
