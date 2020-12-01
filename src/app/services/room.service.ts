import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {Router} from '@angular/router';
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
  wordList: 'default',
  enforceTimer: false,
  userIds: [],
};

@Injectable({providedIn: 'root'})
export class RoomService {
  private db: firestore.Firestore;

  // the purpose of this map is to allow room generation with a fun name that
  // isn't just the id. when a user navs to a room via the input on the home
  // page, we'll save that name and use it if we end up needing to create the
  // room
  private roomNames: {[roomId: string]: string} = {};

  roomObservables: {[roomId: string]: Observable<Room>} = {};

  constructor(
      private readonly authService: AuthService,
      private readonly afs: AngularFirestore,
      private readonly router: Router,
  ) {
    this.db = firestore();
  }

  async createRoom(partial: Partial<Room>): Promise<string> {
    const id = this.getRoomId(partial.id);
    const room = await this.db.collection('rooms').doc(id).get();

    // if the game doesn't exist, create it
    if (!room.exists) {
      // see if there is a stored room name from navigating to a new room,
      // otherwise default the name to the id
      if (!partial.name) {
        partial.name = this.roomNames[id] || id;
      }

      // create the new room with default settings and any values passed in
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
   * Given a room's name or id, nav to that room and save the parameter as the
   * name of the room so we can use this when creating the room if need be
   * @param nameOrId either the room name or id
   */
  navToRoom(nameOrId: string) {
    const id = this.getRoomId(nameOrId);
    this.roomNames[id] = nameOrId;
    this.router.navigate([id]);
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
