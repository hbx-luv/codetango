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

  updateWordList(id: string, words: string[]) {
    return this.afs.collection('wordlists').doc(id).update({words});
  }
}
