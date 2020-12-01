import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {firestore} from 'firebase';
import {without} from 'lodash';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Room, RoomStatus} from 'types';

import {AuthService} from './auth.service';

const defaultRoom = {
  status: RoomStatus.PREGAME,
  timer: 120,
  firstTurnTimer: 180,
  guessIncrement: 30,
  wordList: 'original',
  enforceTimer: false,
  userIds: []
};

@Injectable({providedIn: 'root'})
export class RoomService {
  private db: firestore.Firestore;

  roomObservables: {[roomId: string]: Observable<Room>} = {};

  constructor(
      private readonly authService: AuthService,
      private readonly afs: AngularFirestore,
  ) {
    this.db = firestore();
  }

  async createRoom(partial: Partial<Room>): Promise<string> {
    const id = this.getRoomId(partial.name);
    const room = await this.db.collection('rooms').doc(id).get();

    // if the game doesn't exist, create it
    if (!room.exists) {
      await this.afs.collection('rooms').doc(id).set(
          {...defaultRoom, ...partial, id});
    }

    // return the doc id
    return id;
  }

  updateRoom(id: string, room: Partial<Room>) {
    return this.afs.collection('rooms').doc(id).update(room);
  }

  getRoom(id: string): Observable<Room> {
    // load from cache when we can
    if (this.roomObservables[id]) {
      return this.roomObservables[id];
    }

    // otherwise query for the room
    const room$ =
        this.afs.collection('rooms').doc<Room>(id).snapshotChanges().pipe(
            map(room => {
              const {id: docId, exists} = room.payload;
              return {...room.payload.data(), id: docId, exists};
            }));

    // save to cache and return
    this.roomObservables[id] = room$;
    return room$;
  }

  async joinRoom(roomId: string): Promise<void> {
    if (this.authService.authenticated) {
      const {currentUserId} = this.authService;

      // join the room
      await this.afs.collection('rooms').doc(roomId).update({
        userIds: firestore.FieldValue.arrayUnion(currentUserId),
      });

      // fetch the existing rooms for the authenticaterd user
      const userRef = this.db.collection('users').doc(currentUserId);
      const userSnapshot = await userRef.get();
      const {rooms = []} = userSnapshot.data();

      // put the room id first, then add all the others behind
      await userRef.update({rooms: [roomId].concat(without(rooms, roomId))});
    }
  }

  removeUserFromRoom(roomId: string, userId: string) {
    return this.afs.collection('rooms').doc(roomId).update({
      userIds: firestore.FieldValue.arrayRemove(userId),
    });
  }

  /**
   * "Suh dude!" turns into "suh-dude"
   */
  getRoomId(name: string = ''): string {
    return name.toLowerCase()
        .replace(/[^a-zA-Z0-9 \-]/g, '')  // remove illegal values
        .replace(/[ ]/g, '-');            // spaces to dashes
  }
}
