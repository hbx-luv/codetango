import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {User} from '../../../types';

@Injectable({providedIn: 'root'})
export class UserService {
  userObservables: {[userId: string]: Observable<User>} = {};

  constructor(
      private readonly afs: AngularFirestore,
  ) {}

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
              return user;
            }));

    // save to cache and return
    this.userObservables[userId] = user$;
    return user$;
  }
}
