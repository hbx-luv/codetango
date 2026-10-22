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
import {map, switchMap} from 'rxjs/operators';
import {UserToUserStats} from 'types';

import {StatsSetService} from './stats-set.service';

@Injectable({providedIn: 'root'})
export class UserToUserHistoryService {
  constructor(
      private readonly firestore: Firestore,
      private readonly statsSet: StatsSetService,
  ) {}

  getUserToUserStats(myUserId: string, theirUserId: string):
      Observable<UserToUserStats|undefined> {
    // Follows the live stats set so a recalc flip swaps the whole record at
    // once rather than updating it piecemeal.
    return this.statsSet.collections$.pipe(
        switchMap(({u2u}) => {
          const q = query(
              collection(this.firestore, u2u),
              where('myUserId', '==', myUserId),
              where('theirUserId', '==', theirUserId),
              orderBy('timestamp', 'desc'),
              limit(1),
          );
          return collectionData(q);
        }),
        map(stats => (stats && stats.length ? (stats[0] as UserToUserStats) :
                                              undefined)),
    );
  }
}
