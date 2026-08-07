import {Injectable} from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  Firestore,
  orderBy,
  query,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';

export interface BotInvite {
  team: 'RED'|'BLUE';
  asSpymaster?: boolean;
  createdAt?: number;
  id?: string;
}

@Injectable({providedIn: 'root'})
export class BotService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * Invite a bot by writing an invite doc. A Cloud Function
   * (onCreateBotInvite) reacts, creates the bot user, seats it on the team,
   * and deletes the invite. We react to a write rather than call a callable so
   * the click is instant; the UI shows a pending pill until the invite clears.
   */
  inviteBot(gameId: string, team: 'RED'|'BLUE', asSpymaster = false) {
    return addDoc(collection(this.firestore, 'games', gameId, 'bot-invites'), {
      team,
      asSpymaster,
      createdAt: Date.now(),
    });
  }

  /** Pending (not-yet-seated) bot invites for this game. */
  getPendingInvites(gameId: string): Observable<BotInvite[]> {
    const q = query(
        collection(this.firestore, 'games', gameId, 'bot-invites'),
        orderBy('createdAt', 'asc'));
    return collectionData(q, {idField: 'id'}) as Observable<BotInvite[]>;
  }

  /**
   * Lobby variant: invite a bot into the ROOM's player pool (before teams
   * exist). A Cloud Function (onCreateRoomBotInvite) creates the bot and adds
   * it to room.userIds; then "Assign Teams" distributes it.
   */
  inviteRoomBot(roomId: string) {
    return addDoc(collection(this.firestore, 'rooms', roomId, 'bot-invites'), {
      createdAt: Date.now(),
    });
  }

  getRoomPendingInvites(roomId: string): Observable<BotInvite[]> {
    const q = query(
        collection(this.firestore, 'rooms', roomId, 'bot-invites'),
        orderBy('createdAt', 'asc'));
    return collectionData(q, {idField: 'id'}) as Observable<BotInvite[]>;
  }
}
