import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import * as _ from 'lodash';
import {DateTime} from 'luxon';
import * as moment from 'moment';
import {map, take} from 'rxjs/operators';
import {Stats} from 'types';

// set this to true to hide provisional games
const NO_PROVISIONAL = false;

@Injectable({providedIn: 'root'})
export class EloHistoryService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getEloHistoryForUser(userId: string, limit?: number) {
    return this.afs
        .collection(
            'eloHistory',
            ref => {
              let query = ref.where('userId', '==', userId)
                              .orderBy('timestamp', 'desc');

              if (NO_PROVISIONAL) {
                query = query.where('provisional', '==', false);
              }

              if (limit) {
                query = query.limit(limit)
              }

              return query;
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
  getEloAt(timestamp: number, userId: string): Promise<Stats|undefined> {
    return new Promise(resolve => {
      this.afs
          .collection<Stats>(
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
              let query = ref.where('userId', '==', userId)
                              .orderBy('elo', order)
                              .limit(1);

              if (NO_PROVISIONAL) {
                query = query.where('provisional', '==', false);
              }

              return query;
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

  getMidnight(daysAgo: number = 0) {
    return DateTime.local().minus({days: daysAgo}).startOf('day').toMillis();
  }
}
