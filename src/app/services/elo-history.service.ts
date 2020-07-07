import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import * as _ from 'lodash';
import * as moment from 'moment';
import {map, take} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class EloHistoryService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getEloHistoryForUser(userId: string, limit: number) {
    return this.afs
        .collection(
            'eloHistory',
            ref => {
              return ref
                  .where('userId', '==', userId)
                  // .where('provisional', '==', false)
                  .orderBy('timestamp', 'desc')
                  .limit(limit);
            })
        .snapshotChanges()
        .pipe(map(actions => {
          return _(actions)
              .map(this.mapDataPoints.bind(this))
              .reverse()
              .value();
        }));
  }

  getHighestElo(userId: string) {
    return this.getPeakElo(userId, 'desc');
  }

  getLowestElo(userId: string) {
    return this.getPeakElo(userId, 'asc');
  }

  /**
   * Returns either the first record for a player before a given
   * timestamp, or undefined if none are found before the timestamp
   * @param timestamp
   * @param userId
   */
  getEloAt(timestamp: number, userId: string) {
    return new Promise(resolve => {
      this.afs
          .collection(
              'eloHistory',
              ref => {
                return ref.where('userId', '==', userId)
                    .where('timestamp', '<=', timestamp)
                    .orderBy('timestamp', 'desc')
                    .limit(1);
              })
          .valueChanges()
          .pipe(take(1))
          .subscribe(elo => {
            resolve(elo.length ? elo[0] : undefined);
          });
    });
  }

  getPeakElo(userId: string, order: 'desc'|'asc') {
    return this.afs
        .collection(
            'eloHistory',
            ref => {
              return ref
                  .where('userId', '==', userId)
                  // .where('provisional', '==', false)
                  .orderBy('elo', order)
                  .limit(1);
            })
        .valueChanges();
  }

  mapDataPoints(dataPoint) {
    const doc = dataPoint.payload.doc || dataPoint.payload;

    const data = this.sanitize(doc.data());
    const id = doc.id;

    data.date = moment(data.timestamp).format('MM/DD');

    return {id, ...data};
  }

  sanitize(dataPoint) {
    return _.omit(dataPoint, ['date']);
  }
}
