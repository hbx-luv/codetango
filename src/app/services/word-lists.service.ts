import {Injectable} from '@angular/core';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {GameType, WordList} from 'types';

import {christmasWordList} from './word-lists/christmas-word-list';
import {deepUndercoverWordList} from './word-lists/deep-undercover-word-list';
import {duetWordList} from './word-lists/duet-word-list';
import {emojiWordList} from './word-lists/emoji-word-list';
import {halloweenWordList} from './word-lists/halloween-word-list';
import {memesWordList} from './word-lists/memes-word-list';
import {mlkWordList} from './word-lists/mlk-word-list';
import {originalWordList} from './word-lists/original-word-list';
import {popCultureWordList} from './word-lists/pop-culture-word-list';
import {technologyWordList} from './word-lists/technology-word-list';
import {thanksgivingWordList} from './word-lists/thanksgiving-word-list';
import {tvWordList} from './word-lists/tv-word-list';

@Injectable({providedIn: 'root'})
export class WordListsService {
  constructor(
      private afs: AngularFirestore,
  ) {}

  getGameType(wordList: string): GameType {
    switch (wordList) {
      case 'memes':
        return GameType.MEMES;
      case 'pictures':
        return GameType.PICTURES;
      case 'emojis':
        return GameType.EMOJIS;
      case 'emoji-remix':
        return GameType.EMOJI_REMIX;
      default:
        return GameType.WORDS;
    }
  }

  getWordLists(): Observable<WordList[]> {
    return this.afs.collection<WordList>('wordlists').valueChanges();
  }

  createWordList(name: string, words: string[]): Promise<DocumentReference> {
    return this.afs.collection('wordlists').add({name, words});
  }

  setWordList(name: string, words: string[]): Promise<void> {
    return this.afs.collection('wordlists').doc(name).set({name, words});
  }

  // Warning - this is a complete replacement update
  updateWordList(id: string, words: string[]): Promise<void> {
    return this.afs.collection('wordlists').doc(id).update({words});
  }

  // Use this if you need to setup a new database with the word lists
  setupDatabase() {
    this.setWordList('default', [...originalWordList, ...duetWordList]);
    this.setWordList('original', originalWordList);
    this.setWordList('deepUndercover', deepUndercoverWordList);
    this.setWordList('duetWords', duetWordList);
    this.setWordList('emojis', emojiWordList);
    this.setWordList('memes', memesWordList);
    this.setWordList('pictures', this.getPicturesWordList());
    this.setWordList('emoji-remix', this.getEmojiRemixWordList());
    this.setWordList('tvWords', tvWordList);
    this.setWordList('popCultureWordList', popCultureWordList);
    this.setWordList('technologyWords', technologyWordList);
    this.setWordList('thanksgiving', thanksgivingWordList);
    this.setWordList('christmas', christmasWordList);
    this.setWordList('mlk', mlkWordList);
    this.setWordList('halloween', halloweenWordList);
    this.setWordList(
        'winter',
        halloweenWordList.concat(thanksgivingWordList, christmasWordList));
  }

  private getPicturesWordList(): string[] {
    return [...Array(100).keys()].map(a => ('00' + a).slice(-2));
  }
  private getEmojiRemixWordList(): string[] {
    return [...Array(100).keys()].map(a => `${a + 1}`);
  }
}
