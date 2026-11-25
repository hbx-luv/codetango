import {Injectable} from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {shareReplay} from 'rxjs/operators';
import {BUILT_IN_GAME_TYPES, Game, GameType, WORD_LIST_LIMITS, WordList, WordSourceType} from 'types';

import {AuthService} from './auth.service';
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

/** A built-in list as the picker shows it. */
export interface BuiltInWordList {
  id: string;
  name: string;
  tagline: string;
  cover: string;
  gameType: GameType;
}

function builtIn(id: string, name: string, tagline: string, cover: string):
    BuiltInWordList {
  return {
    id,
    name,
    tagline,
    cover: `./assets/${cover}.png`,
    gameType: BUILT_IN_GAME_TYPES[id] ?? GameType.WORDS,
  };
}

/** The default lists, in the order the picker shows them. */
export const BUILT_IN_WORD_LISTS: BuiltInWordList[] = [
  builtIn('original', 'Original', 'The classic word deck', 'original'),
  builtIn('emojis', 'Emojis', 'Clue your way through emoji', 'emojis'),
  builtIn('memes', 'Memes', 'A board of well-worn memes', 'memes'),
  builtIn('pictures', 'Pictures', 'Surreal illustrated cards', 'pictures'),
  builtIn(
      'technologyWords', 'Technology', 'For the engineers in the room',
      'technology-words'),
  builtIn(
      'emoji-remix', 'Emoji Remix', 'Mashed-up emoji hybrids', 'emoji-remix'),
];

// What a room plays when it has nothing picked. New rooms start on 'default'
// (original + duet words), which the picker presents as Original.
const DEFAULT_LIST_ID = 'original';
const DEFAULT_LIST_ALIASES = ['', 'default'];

// More than anyone will scroll; revisit with paging if the library gets big.
const LIBRARY_LIMIT = 200;

/** The editable parts of a player-made list. */
export type WordListDraft =
    Pick<WordList, 'name'|'words'|'gameType'|'description'|'prompt'>;

@Injectable({providedIn: 'root'})
export class WordListsService {
  /**
   * Every player-made list, newest first. Built-in docs have no `createdAt`,
   * so ordering by it leaves them out.
   */
  readonly library$: Observable<WordList[]> =
      (collectionData(
           query(
               collection(this.firestore, 'wordlists'),
               orderBy('createdAt', 'desc'), limit(LIBRARY_LIMIT)),
           {idField: 'id'}) as Observable<WordList[]>)
          .pipe(shareReplay({bufferSize: 1, refCount: true}));

  constructor(
      private readonly firestore: Firestore,
      private readonly authService: AuthService,
  ) {}

  /** The built-in list a room's `wordList` setting points at, if any. */
  getBuiltIn(wordList: string|undefined): BuiltInWordList|undefined {
    const id = DEFAULT_LIST_ALIASES.includes(wordList ?? '') ?
        DEFAULT_LIST_ID :
        wordList;
    return BUILT_IN_WORD_LISTS.find(list => list.id === id);
  }

  canEdit(list: WordList): boolean {
    return !!list.createdBy && this.authService.authenticated &&
        list.createdBy === this.authService.currentUserId;
  }

  /** Save a new list owned by the current user; returns its id. */
  async createList(draft: WordListDraft): Promise<string> {
    const now = Date.now();
    const ref = await addDoc(collection(this.firestore, 'wordlists'), {
      ...this.clean(draft),
      createdBy: this.authService.currentUserId,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }

  updateList(id: string, draft: WordListDraft): Promise<void> {
    const clean = this.clean(draft);
    return updateDoc(doc(this.firestore, 'wordlists', id), {
      ...clean,
      // an emptied description has to be removed, not just left out
      description: clean.description ?? deleteField(),
      updatedAt: Date.now(),
    });
  }

  deleteList(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'wordlists', id));
  }

  /**
   * Turn the words an AI generated for a game into a reusable list, and
   * point the game at it so the next viewer sees it's already saved.
   */
  async saveFromGame(game: Game, name: string): Promise<string> {
    const {prompt, pool} = game.wordSource ?? {};
    if (game.wordSource?.type !== WordSourceType.AI || !pool?.length) {
      throw new Error('this game has no generated words to save');
    }
    const id = await this.createList(
        {name, words: pool, gameType: GameType.WORDS, prompt});
    await updateDoc(doc(this.firestore, 'games', game.id), {
      'wordSource.listId': id,
      'wordSource.listName': name,
    });
    return id;
  }

  // Firestore rejects undefined, so optional fields are only written when set
  private clean(draft: WordListDraft): WordListDraft {
    const out: WordListDraft = {
      name: draft.name.trim().slice(0, WORD_LIST_LIMITS.nameLength),
      words: draft.words,
      gameType: draft.gameType,
    };
    const description = draft.description?.trim();
    if (description) {
      out.description = description.slice(0, WORD_LIST_LIMITS.descriptionLength);
    }
    if (draft.prompt) {
      out.prompt = draft.prompt;
    }
    return out;
  }

  // Use this if you need to setup a new database with the word lists
  setupDatabase() {
    this.seed('default', [...originalWordList, ...duetWordList]);
    this.seed('original', originalWordList);
    this.seed('deepUndercover', deepUndercoverWordList);
    this.seed('duetWords', duetWordList);
    this.seed('emojis', emojiWordList);
    this.seed('memes', memesWordList);
    this.seed('pictures', this.getPicturesWordList());
    this.seed('emoji-remix', this.getEmojiRemixWordList());
    this.seed('tvWords', tvWordList);
    this.seed('popCultureWordList', popCultureWordList);
    this.seed('technologyWords', technologyWordList);
    this.seed('thanksgiving', thanksgivingWordList);
    this.seed('christmas', christmasWordList);
    this.seed('mlk', mlkWordList);
    this.seed('halloween', halloweenWordList);
    this.seed(
        'winter',
        halloweenWordList.concat(thanksgivingWordList, christmasWordList));
  }

  private seed(id: string, words: string[]): Promise<void> {
    const name = BUILT_IN_WORD_LISTS.find(list => list.id === id)?.name ?? id;
    return setDoc(doc(this.firestore, 'wordlists', id), {name, words});
  }

  private getPicturesWordList(): string[] {
    return [...Array(100).keys()].map(a => ('00' + a).slice(-2));
  }
  private getEmojiRemixWordList(): string[] {
    return [...Array(170).keys()].map(a => `${a}`);
  }
}
