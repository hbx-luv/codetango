import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import * as _ from 'lodash';
import {Observable} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {UserToUserStats} from 'types';

@Injectable({providedIn: 'root'})
export class UserToUserHistoryService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getUserToUserStats(myUserId: string, theirUserId: string):
      Observable<UserToUserStats|undefined> {
    return this.afs
        .collection<UserToUserStats>(
            'userToUserHistory',
            ref => {
              let query = ref.where('myUserId', '==', myUserId)
                              .where('theirUserId', '==', theirUserId)
                              .orderBy('timestamp', 'desc')
                              .limit(1);
              return query;
            })
        .valueChanges()
        .pipe(map(stats => {
          return stats && stats.length ? stats[0] : undefined;
        }));
  }

  mapDataPoints(dataPoint) {
    const doc = dataPoint.payload.doc || dataPoint.payload;

    const data = doc.data();
    const id = doc.id;

    return {id, ...data};
  }
}
