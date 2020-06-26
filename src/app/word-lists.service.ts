import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';

@Injectable({providedIn: 'root'})
export class WordListsService {
  constructor(
      private afs: AngularFirestore,
  ) {}

  getWordLists() {
    return this.afs.collection('wordlists').valueChanges();
  }

  createWordList(name: string, words: string[]): Promise<DocumentReference> {
    return this.afs.collection('wordlists').add({name, words});
  }
}
