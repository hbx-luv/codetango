import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {Room} from 'types';

@Injectable({providedIn: 'root'})
export class RoomService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  getRoom(id: string): Observable<Room> {
    return this.afs.collection('rooms').doc<Room>(id).valueChanges();
  }
}
