import {EventEmitter, Injectable} from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  DocumentReference,
  Firestore,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {Message} from 'types';

@Injectable({providedIn: 'root'})
export class MessageService {
  chatShown = false;
  unreadMessages?: number;
  chatShown$ = new EventEmitter();

  constructor(
      private readonly firestore: Firestore,
  ) {}

  sendSpymasterMessage(gameId: string, message: Partial<Message>):
      Promise<DocumentReference> {
    return addDoc(
        collection(this.firestore, 'games', gameId, 'spymaster-chat'), {
          timestamp: serverTimestamp(),
          text: message.text,
          ...message,
        });
  }

  sendSpymasterServerMessage(gameId: string, text: string):
      Promise<DocumentReference> {
    return this.sendSpymasterMessage(gameId, {text, fromServer: true});
  }

  getSpymasterMessages(gameId: string): Observable<Message[]> {
    const q = query(
        collection(this.firestore, 'games', gameId, 'spymaster-chat'),
        orderBy('timestamp'),
    );
    return collectionData(q) as Observable<Message[]>;
  }

  toggleChatShown(setTo?: boolean) {
    this.chatShown = setTo !== undefined ? setTo : !this.chatShown;
    this.unreadMessages = 0;
    this.chatShown$.emit();
  }
}
