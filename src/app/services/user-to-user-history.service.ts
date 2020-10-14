import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import * as _ from 'lodash';
import {map, take} from 'rxjs/operators';
import {UserToUserStats} from 'types';

@Injectable({providedIn: 'root'})
export class UserToUserHistoryService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getUserToUserStats(myUserId: string, theirUserId: string):
      Promise<UserToUserStats|undefined> {
    return new Promise(resolve => {
      this.afs
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
          .pipe(take(1))
          .subscribe(stats => {
            resolve(stats.length ? stats[0] : undefined);
          });
    });
  }

  mapDataPoints(dataPoint) {
    const doc = dataPoint.payload.doc || dataPoint.payload;

    const data = doc.data();
    const id = doc.id;

    return {id, ...data};
  }
}
