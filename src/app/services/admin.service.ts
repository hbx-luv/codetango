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
import {RecalcJob, User} from 'types';

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

  // Kick off a merge job. Cloud Function reads this doc, initializes the job
  // status, and drives the migrating -> recalculating -> committing loop.
  startMerge(
      oldUserId: string,
      newUserId: string,
      oldUserName?: string,
      newUserName?: string,
      ): Promise<void> {
    return setDoc(doc(this.firestore, 'admin', 'startMerge'), {
      oldUserId,
      newUserId,
      ...(oldUserName ? {oldUserName} : {}),
      ...(newUserName ? {newUserName} : {}),
    });
  }

  // Kick off a full staged recalc. Same lifecycle as merge but skips the
  // migrating phase.
  startRecalc(): Promise<void> {
    return setDoc(
        doc(this.firestore, 'admin', 'startRecalc'),
        {triggeredAt: Date.now()},
    );
  }
}
