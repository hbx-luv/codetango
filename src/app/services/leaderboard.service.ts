import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {User} from 'types';

@Injectable({providedIn: 'root'})
export class LeaderboardService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getLeaderboard(roomId: string): Observable<User[]> {
    return this.afs
        .collection<User>(
            'users',
            ref => {
              return ref.where('rooms', 'array-contains', roomId)
                  .orderBy('stats.elo', 'desc');
            })
        .snapshotChanges()
        .pipe(map(actions => {
          return actions.map(action => {
            const {doc} = action.payload;
            return {id: doc.id, ...doc.data()};
          });
        }));
  }
}
