import {Injectable} from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  getCountFromServer,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {MergePair, RecalcJob, User} from 'types';

@Injectable({providedIn: 'root'})
export class AdminService {
  constructor(private readonly firestore: Firestore) {}

  // All users, for the merge pickers. Admins can read /users (see rules).
  getAllUsers(): Observable<User[]> {
    return collectionData(
        collection(this.firestore, 'users'),
        {idField: 'id'},
        ) as Observable<User[]>;
  }

  // Live status doc for the currently-running admin job (merge or recalc).
  // Emits undefined when no job has ever run.
  getCurrentJob(): Observable<RecalcJob|undefined> {
    return docData(doc(this.firestore, 'adminJobs', 'current')) as
        Observable<RecalcJob|undefined>;
  }

  // Count games the given user appears in — used for the merge preview so
  // the admin can see the size of what they're about to migrate.
  async countGamesForUser(userId: string): Promise<number> {
    const q = query(
        collection(this.firestore, 'games'),
        where('userIds', 'array-contains', userId),
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  }

  // Kick off a merge job for one or more account pairs. The Cloud Function
  // rewrites every game for every pair, then rebuilds history from the
  // earliest affected game into the inactive stats set and flips to it.
  startMerge(pairs: MergePair[]): Promise<void> {
    return setDoc(doc(this.firestore, 'admin', 'startMerge'), {
      pairs: pairs.map(p => ({
        oldUserId: p.oldUserId,
        newUserId: p.newUserId,
        ...(p.oldUserName ? {oldUserName: p.oldUserName} : {}),
        ...(p.newUserName ? {newUserName: p.newUserName} : {}),
      })),
      triggeredAt: Date.now(),
    });
  }

  // Kick off a full rebuild into the inactive set. Same lifecycle as a
  // merge, minus the migrate and seed phases.
  startRecalc(): Promise<void> {
    return setDoc(
        doc(this.firestore, 'admin', 'startRecalc'),
        {triggeredAt: Date.now()},
    );
  }

  // Re-fire the continue trigger for a job whose last step never reported
  // back (e.g. the function instance died). The seq guard means this is a
  // no-op if the job is actually still moving.
  resumeJob(seq: number): Promise<void> {
    return setDoc(
        doc(this.firestore, 'admin', 'continue'),
        {seq, triggeredAt: Date.now()},
    );
  }

  // Abort the active job. Nothing live has changed before the commit
  // phase, and the build set is wiped at the start of the next job.
  cancelJob(): Promise<void> {
    return setDoc(
        doc(this.firestore, 'admin', 'cancel'),
        {triggeredAt: Date.now()},
    );
  }
}
