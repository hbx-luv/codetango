import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';

import {User} from '../../../types';

@Injectable({providedIn: 'root'})
export class UserService {
  userObservables: {[userId: string]: Observable<User>} = {};

  currentUser$?: Subscription;
  currentUser?: User;

  constructor(
      private readonly afAuth: AngularFireAuth,
      private readonly afs: AngularFirestore,
  ) {
    this.afAuth.authState.subscribe(observer => {
      if (observer && observer.uid) {
        this.subscribeToUser(observer.uid);
      } else {
        if (this.currentUser$) {
          this.currentUser$.unsubscribe();
          delete this.currentUser$;
        }
        delete this.currentUser;
      }
    });
  }

  subscribeToUser(uid: string) {
    // unsubscribe from current user observable
    if (this.currentUser$) {
      this.currentUser$.unsubscribe();
    }

    // subscribe to user changes
    this.currentUser$ = this.getUser(uid).subscribe(user => {
      this.currentUser = user;
    });
  }

  getUser(userId: string): Observable<User> {
    // load from cache when we can
    if (this.userObservables[userId]) {
      return this.userObservables[userId];
    }

    // otherwise query for the user
    const user$ =
        this.afs.collection('users').doc<User>(userId).valueChanges().pipe(
            map(user => {
              if (user === undefined) {
                user = {name: userId, email: userId, rooms: []};
              }
              user.rooms = user.rooms || [];
              user.id = userId;
              return user;
            }));

    // save to cache and return
    this.userObservables[userId] = user$;
    return user$;
  }

  updateUser(userId: string, data: Partial<User>): Promise<void> {
    return this.afs.collection('users').doc(userId).update(data);
  }
}
