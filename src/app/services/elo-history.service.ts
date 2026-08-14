import {Injectable} from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  limit,
  orderBy,
  query,
  QueryConstraint,
  where,
} from '@angular/fire/firestore';
import {firstValueFrom, Observable} from 'rxjs';
import {DateTime} from 'luxon';
import {map, take} from 'rxjs/operators';
import {Stats} from 'types';

// set this to true to hide provisional games
const NO_PROVISIONAL = false;

@Injectable({providedIn: 'root'})
export class EloHistoryService {
  constructor(
      private readonly firestore: Firestore,
  ) {}

  getEloHistoryForUser(userId: string, limitCount?: number) {
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
    ];
    if (NO_PROVISIONAL) {
      constraints.push(where('provisional', '==', false));
    }
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    const q = query(
        collection(this.firestore, 'eloHistory'),
        ...constraints,
    );
    return collectionData(q, {idField: 'id'}).pipe(map(actions => {
      return actions.map(this.mapDataPoint.bind(this)).reverse();
    }));
  }

  getHighestElo(userId: string) {
    return this.getPeakElo(userId, 'desc');
  }

  getLowestElo(userId: string) {
    return this.getPeakElo(userId, 'asc');
  }

  /**
   * Streams the stats snapshots written for every player in a given game.
   *
   * This is a live stream, not a one-shot read, because the records are
   * written by the recalcElo Cloud Function *after* the game ends — so they
   * often don't all exist yet when the post-game stats modal opens. Callers
   * subscribe and let each player's snapshot fill in as recalc commits it.
   *
   * The doc id (`idField`) is included so the player can be recovered from the
   * `${userId}_${gameId}` key even for any record missing a `userId` field.
   */
  getStatsForGame(gameId: string): Observable<Array<Stats&{id: string}>> {
    const q = query(
        collection(this.firestore, 'eloHistory'),
        where('gameId', '==', gameId),
    );
    return collectionData(q, {idField: 'id'}) as
        Observable<Array<Stats&{id: string}>>;
  }

  /**
   * Returns either the first record for a player before a given
   * timestamp, or undefined if none are found before the timestamp
   */
  async getEloAt(timestamp: number, userId: string):
      Promise<Stats|undefined> {
    const q = query(
        collection(this.firestore, 'eloHistory'),
        where('userId', '==', userId),
        where('timestamp', '<=', timestamp),
        orderBy('timestamp', 'desc'),
        limit(1),
    );
    const elo = await firstValueFrom(
        collectionData(q).pipe(take(1)) as any,
    ) as Stats[];
    return elo.length ? elo[0] : undefined;
  }

  getPeakElo(userId: string, order: 'desc'|'asc') {
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('elo', order),
      limit(1),
    ];
    if (NO_PROVISIONAL) {
      constraints.push(where('provisional', '==', false));
    }
    const q = query(collection(this.firestore, 'eloHistory'), ...constraints);
    return collectionData(q);
  }

  mapDataPoint(dataPoint: any) {
    const data = this.sanitize(dataPoint);
    data.date = DateTime.fromMillis(data.timestamp).toFormat('MM/dd');
    return data;
  }

  sanitize(dataPoint: any) {
    const {date: _date, ...rest} = dataPoint;
    return rest;
  }

  getMidnight(daysAgo: number = 0) {
    return DateTime.local().minus({days: daysAgo}).startOf('day').toMillis();
  }
}
