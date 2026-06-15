import {Injectable} from '@angular/core';
import {
  arrayRemove,
  arrayUnion,
  doc,
  docData,
  Firestore,
  getDoc,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {Router} from '@angular/router';
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
  // the purpose of this map is to allow room generation with a fun name that
  // isn't just the id. when a user navs to a room via the input on the home
  // page, we'll save that name and use it if we end up needing to create the
  // room
  private roomNames: {[roomId: string]: string} = {};

  roomObservables: {[roomId: string]: Observable<Room>} = {};

  constructor(
      private readonly authService: AuthService,
      private readonly firestore: Firestore,
      private readonly router: Router,
  ) {}

  async createRoom(partial: Partial<Room>): Promise<string> {
    const id = this.getRoomId(partial.id);
    const ref = doc(this.firestore, 'rooms', id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      if (!partial.name) {
        partial.name = this.roomNames[id] || id;
      }
      await setDoc(ref, {...defaultRoom, ...partial, id});
    }

    return id;
  }

  updateRoom(id: string, room: Partial<Room>) {
    return updateDoc(doc(this.firestore, 'rooms', id), room);
  }

  getRoom(id: string): Observable<Room> {
    if (this.roomObservables[id]) {
      return this.roomObservables[id];
    }

    const ref = doc(this.firestore, 'rooms', id);
    const room$ = docData(ref, {idField: 'id'}).pipe(
        map(data => {
          // docData returns undefined when doc doesn't exist; preserve
          // backward-compatible {exists: false} shape for callers
          if (!data) {
            return {id, exists: false} as unknown as Room;
          }
          return {...(data as Room), id, exists: true};
        }),
    );

    this.roomObservables[id] = room$;
    return room$;
  }

  async joinRoom(roomId: string): Promise<void> {
    if (this.authService.authenticated) {
      const {currentUserId} = this.authService;
      await updateDoc(doc(this.firestore, 'rooms', roomId), {
        userIds: arrayUnion(currentUserId),
      });
    }
  }

  removeUserFromRoom(roomId: string, userId: string) {
    return updateDoc(doc(this.firestore, 'rooms', roomId), {
      userIds: arrayRemove(userId),
    });
  }

  navToRoom(nameOrId: string) {
    const id = this.getRoomId(nameOrId);
    this.roomNames[id] = nameOrId;
    this.router.navigate([id]);
  }

  getRoomId(name: string = ''): string {
    return name.toLowerCase()
        .replace(/[^a-zA-Z0-9 -]/g, '')
        .replace(/[ ]/g, '-');
  }
}
