import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {User} from '../../../types';

@Injectable({providedIn: 'root'})
export class UserService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getUser(userId: string): Observable<User> {
    return this.afs.collection('users').doc<User>(userId).valueChanges().pipe(
        map(user => {
          if (user === undefined) {
            user = {name: userId, email: userId, rooms: []};
          }
          user.rooms = user.rooms || [];
          return user;
        }));
  }
}
