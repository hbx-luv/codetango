import {Injectable} from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  limit,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {UserToUserStats} from 'types';

@Injectable({providedIn: 'root'})
export class UserToUserHistoryService {
  constructor(
      private readonly firestore: Firestore,
  ) {}

  getUserToUserStats(myUserId: string, theirUserId: string):
      Observable<UserToUserStats|undefined> {
    const q = query(
        collection(this.firestore, 'userToUserHistory'),
        where('myUserId', '==', myUserId),
        where('theirUserId', '==', theirUserId),
        orderBy('timestamp', 'desc'),
        limit(1),
    );
    return collectionData(q).pipe(
        map(stats => (stats && stats.length ? (stats[0] as UserToUserStats) :
                                              undefined)),
    );
  }
}
