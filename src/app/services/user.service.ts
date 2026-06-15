import {EventEmitter, Injectable} from '@angular/core';
import {Auth, authState} from '@angular/fire/auth';
import {doc, docData, Firestore, updateDoc} from '@angular/fire/firestore';
import {Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';

import {User} from '../../../types';

@Injectable({providedIn: 'root'})
export class UserService {
  userObservables: {[userId: string]: Observable<User>} = {};

  currentUser$?: Subscription;
  currentUser?: User;
  userChanged$: EventEmitter<User>;

  constructor(
      private readonly auth: Auth,
      private readonly firestore: Firestore,
  ) {
    authState(this.auth).subscribe(observer => {
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

    this.userChanged$ = new EventEmitter<User>();
  }

  subscribeToUser(uid: string) {
    if (this.currentUser$) {
      this.currentUser$.unsubscribe();
    }

    this.currentUser$ = this.getUser(uid).subscribe(user => {
      this.currentUser = user;
      this.userChanged$.emit(user);
    });
  }

  getUser(userId: string): Observable<User> {
    if (this.userObservables[userId]) {
      return this.userObservables[userId];
    }

    const ref = doc(this.firestore, 'users', userId);
    const user$ = docData(ref).pipe(
        map(data => {
          let user = data as User | undefined;
          if (user === undefined) {
            user = {name: userId, email: userId, rooms: []};
          }
          user.rooms = user.rooms || [];
          user.id = userId;
          return user;
        }),
    );

    this.userObservables[userId] = user$;
    return user$;
  }

  updateUser(userId: string, data: Partial<User>): Promise<void> {
    return updateDoc(doc(this.firestore, 'users', userId), data);
  }
}
