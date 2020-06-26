import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {firestore} from 'firebase';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Room} from 'types';
import {AuthService} from './auth.service';

@Injectable({providedIn: 'root'})
export class RoomService {
  private db: firestore.Firestore;

  constructor(
      private readonly authService: AuthService,
      private readonly afs: AngularFirestore,
  ) {
    this.db = firestore();
  }

  async createRoom(room: Partial<Room>): Promise<string> {
    const id = this.createRoomId(room.name);
    const game = await this.db.collection('rooms').doc(id).get();

    // if the game doesn't exist, create it
    if (!game.exists) {
      await this.afs.collection('rooms').doc(id).set({id, ...room});
    }

    // return the doc id
    return id;
  }

  updateRoom(id: string, room: Partial<Room>) {
    return this.afs.collection('rooms').doc(id).update(room);
  }

  getRoom(id: string): Observable<Room> {
    return this.afs.collection('rooms').doc<Room>(id).snapshotChanges().pipe(
        map(room => {
          return {id: room.payload.id, ...room.payload.data()};
        }));
  }

  joinRoom(id: string) {
    return this.afs.collection('rooms').doc(id).update({
      userIds: firestore.FieldValue.arrayUnion(this.authService.currentUserId)
    });
  }

  /**
   * "Suh dude!" turns into "suh-dude"
   */
  private createRoomId(name: string): string {
    return name.toLowerCase()
        .replace(/[^a-zA-Z0-9 ]/g, '')  // remove illegal values
        .replace(/[ ]/g, '-');          // spaces to dashes
  }
}
