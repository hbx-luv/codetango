import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {WordList} from 'types';

@Injectable({providedIn: 'root'})
export class WordListsService {
  constructor(
      private afs: AngularFirestore,
  ) {}

  getWordLists(): Observable<WordList[]> {
    return this.afs.collection<WordList>('wordlists').valueChanges();
  }

  createWordList(name: string, words: string[]): Promise<DocumentReference> {
    return this.afs.collection('wordlists').add({name, words});
  }

  // Warning - this is a complete replacement update
  updateWordList(id: string, words: Partial<WordList>): Promise<void> {
    return this.afs.collection('wordlists').doc(id).update(words);
  }
}
