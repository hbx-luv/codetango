import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {Message} from 'types';

@Injectable({providedIn: 'root'})
export class MessageService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  sendSpymasterMessage(gameId: string, message: Message):
      Promise<DocumentReference> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection('spymaster-chat')
        .add(message);
  }

  getSpymasterMessages(gameId: string): Observable<Message[]> {
    return this.afs.collection('games')
        .doc(gameId)
        .collection<Message>('spymaster-chat', ref => ref.orderBy('timestamp'))
        .valueChanges();
  }
}
