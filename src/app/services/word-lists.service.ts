import {Injectable} from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  doc,
  DocumentReference,
  Firestore,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {GameType, ThemedWordlist, WordList} from 'types';

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
      private firestore: Firestore,
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
    return collectionData(collection(this.firestore, 'wordlists')) as
        Observable<WordList[]>;
  }

  // Previously-generated AI themes, newest first. Selecting one reuses its
  // saved word pool (no AI call) — the onCreateGame trigger looks the theme up
  // by name when a game is created.
  getThemedWordlists(): Observable<ThemedWordlist[]> {
    return collectionData(
               query(
                   collection(this.firestore, 'themedWordlists'),
                   orderBy('createdAt', 'desc')),
               {idField: 'id'}) as Observable<ThemedWordlist[]>;
  }

  // Pin/unpin a saved theme to protect it from (or expose it to) the backend's
  // auto-cleanup. Firestore rules only permit the `pinned` field to change here.
  setThemePinned(id: string, pinned: boolean): Promise<void> {
    return updateDoc(doc(this.firestore, 'themedWordlists', id), {pinned});
  }

  createWordList(name: string, words: string[]): Promise<DocumentReference> {
    return addDoc(collection(this.firestore, 'wordlists'), {name, words});
  }

  setWordList(name: string, words: string[]): Promise<void> {
    return setDoc(doc(this.firestore, 'wordlists', name), {name, words});
  }

  // Warning - this is a complete replacement update
  updateWordList(id: string, words: string[]): Promise<void> {
    return updateDoc(doc(this.firestore, 'wordlists', id), {words});
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
    return [...Array(170).keys()].map(a => `${a}`);
  }
}
