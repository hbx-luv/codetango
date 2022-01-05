import {EventEmitter, Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {default as firebase} from 'firebase';
import {Observable} from 'rxjs';
import {Message} from 'types';

@Injectable({providedIn: 'root'})
export class MessageService {
  chatShown = false;
  unreadMessages?: number;
  chatShown$ = new EventEmitter();

  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  sendSpymasterMessage(gameId: string, message: Partial<Message>):
      Promise<DocumentReference> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection<Message>('spymaster-chat')
        .add({
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          text: message.text,
          ...message,
        });
  }

  sendSpymasterServerMessage(gameId: string, text: string):
      Promise<DocumentReference> {
    return this.sendSpymasterMessage(gameId, {text, fromServer: true});
  }

  getSpymasterMessages(gameId: string): Observable<Message[]> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection<Message>('spymaster-chat', ref => ref.orderBy('timestamp'))
        .valueChanges();
  }

  toggleChatShown(setTo?: boolean) {
    this.chatShown = setTo !== undefined ? setTo : !this.chatShown;
    this.unreadMessages = 0;
    this.chatShown$.emit();
  }
}
