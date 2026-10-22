import {Injectable} from '@angular/core';
import {doc, docData, Firestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {distinctUntilChanged, map, shareReplay} from 'rxjs/operators';
import {
  DEFAULT_STATS_SET,
  STATS_COLLECTIONS,
  StatsCollections,
  StatsConfig,
  StatsSet,
} from 'types';

/**
 * Elo history and user-to-user history live in one of two interchangeable
 * collection sets. /system/stats says which one is live; an admin recalc
 * builds the other set in full and then flips the pointer in one write.
 *
 * Every history query goes through `collections$` so the whole app moves
 * to the new set at the same instant, with complete data, instead of
 * watching docs change underneath it mid-recalc.
 */
@Injectable({providedIn: 'root'})
export class StatsSetService {
  readonly liveSet$: Observable<StatsSet>;
  readonly collections$: Observable<StatsCollections>;

  constructor(private readonly firestore: Firestore) {
    this.liveSet$ =
        (docData(doc(this.firestore, 'system', 'stats')) as
         Observable<StatsConfig|undefined>)
            .pipe(
                map(config => config?.liveSet === StatsSet.GREEN ?
                        StatsSet.GREEN :
                        DEFAULT_STATS_SET),
                distinctUntilChanged(),
                shareReplay({bufferSize: 1, refCount: true}),
            );
    this.collections$ =
        this.liveSet$.pipe(map(set => STATS_COLLECTIONS[set]));
  }
}
