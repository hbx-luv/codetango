import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {UserService} from 'src/app/services/user.service';
import {BUILT_IN_WORD_LISTS, BuiltInWordList, WordListsService} from 'src/app/services/word-lists.service';
import {GameType, WORD_LIST_LIMITS, WordList} from 'types';

import {WordListEditorComponent, WordListEditorResult} from '../word-list-editor/word-list-editor.component';

type Tab = 'defaults'|'library'|'ai';
type LibraryFilter = 'all'|'mine'|'words'|'images';

/** The one-line "this is what you're playing" summary above the tabs. */
interface CurrentSelection {
  tab: Tab;
  title: string;
  subtitle: string;
  cover?: string;
  icon?: string;
}

/**
 * Chooses what a room's boards are made from: one of the default lists, a
 * player-made list from the library, or an AI theme. It only reports the
 * choice; the host decides what changing it means (e.g. redealing a board).
 */
@Component({
  standalone: false,
  selector: 'app-word-list-picker',
  templateUrl: './word-list-picker.component.html',
  styleUrls: ['./word-list-picker.component.scss'],
})
export class WordListPickerComponent implements OnInit, OnDestroy {
  // the room's current settings
  @Input() wordList?: string;
  @Input() theme?: string;

  @Output() listSelected = new EventEmitter<string>();
  // a new theme, or null to go back to playing from a list
  @Output() themeSelected = new EventEmitter<string|null>();

  readonly GameType = GameType;
  readonly builtIns = BUILT_IN_WORD_LISTS;
  readonly themeMaxLength = WORD_LIST_LIMITS.themeLength;
  readonly themeIdeas =
      ['90s movies', 'Things in a kitchen', 'Space exploration', 'Road trip'];
  readonly filters: {id: LibraryFilter, label: string}[] = [
    {id: 'all', label: 'All'},
    {id: 'mine', label: 'Mine'},
    {id: 'words', label: 'Words'},
    {id: 'images', label: 'Images'},
  ];

  tab: Tab = 'defaults';
  // undefined until the first snapshot arrives
  library?: WordList[];
  search = '';
  filter: LibraryFilter = 'all';
  themeDraft = '';

  private librarySub?: Subscription;
  private readonly authorNames = new Map<string, Observable<string>>();

  constructor(
      readonly authService: AuthService,
      private readonly wordListsService: WordListsService,
      private readonly userService: UserService,
      private readonly modalCtrl: ModalController,
  ) {}

  ngOnInit() {
    // open on whichever tab holds the current choice
    this.tab = this.theme ? 'ai' : this.selectedBuiltIn ? 'defaults' : 'library';
    this.librarySub = this.wordListsService.library$.subscribe(
        library => this.library = library);
  }

  ngOnDestroy() {
    this.librarySub?.unsubscribe();
  }

  get selectedBuiltIn(): BuiltInWordList|undefined {
    return this.theme ? undefined :
                        this.wordListsService.getBuiltIn(this.wordList);
  }

  isSelected(listId: string): boolean {
    return !this.theme &&
        (this.selectedBuiltIn ? this.selectedBuiltIn.id === listId :
                                this.wordList === listId);
  }

  get current(): CurrentSelection {
    if (this.theme) {
      return {
        tab: 'ai',
        title: `“${this.theme}”`,
        subtitle: 'AI theme — a fresh board is generated every game',
        icon: 'sparkles',
      };
    }
    const builtIn = this.selectedBuiltIn;
    if (builtIn) {
      return {
        tab: 'defaults',
        title: builtIn.name,
        subtitle: builtIn.tagline,
        cover: builtIn.cover,
      };
    }
    const list = this.library?.find(l => l.id === this.wordList);
    return {
      tab: 'library',
      title: list?.name ?? 'Community list',
      subtitle: list ? this.describe(list) :
          this.library ? 'This list was deleted — the Original deck will be dealt' : '',
      icon: list && this.isImages(list) ? 'images-outline' : 'list-outline',
    };
  }

  get visibleLibrary(): WordList[] {
    const search = this.search.trim().toLowerCase();
    return (this.library ?? []).filter(list => {
      switch (this.filter) {
        case 'mine':
          if (!this.wordListsService.canEdit(list)) return false;
          break;
        case 'words':
          if (this.isImages(list)) return false;
          break;
        case 'images':
          if (!this.isImages(list)) return false;
          break;
        default:
      }
      return !search ||
          [list.name, list.description, list.prompt].some(
              text => text?.toLowerCase().includes(search));
    });
  }

  isImages(list: WordList): boolean {
    return list.gameType === GameType.IMAGES;
  }

  isMine(list: WordList): boolean {
    return this.wordListsService.canEdit(list);
  }

  describe(list: WordList): string {
    const count = list.words?.length ?? 0;
    return `${count} ${this.isImages(list) ? 'image' : 'word'}${count === 1 ? '' : 's'}`;
  }

  authorName(userId: string): Observable<string> {
    let name$ = this.authorNames.get(userId);
    if (!name$) {
      name$ = this.userService.getUser(userId).pipe(
          map(user => user.nickname || user.name));
      this.authorNames.set(userId, name$);
    }
    return name$;
  }

  trackById(_index: number, list: {id?: string}) {
    return list.id;
  }

  selectList(listId: string) {
    if (!this.isSelected(listId)) {
      this.listSelected.emit(listId);
    }
  }

  generateTheme(theme = this.themeDraft) {
    theme = theme.trim().slice(0, this.themeMaxLength);
    if (theme) {
      this.themeSelected.emit(theme);
      this.themeDraft = '';
    }
  }

  clearTheme() {
    this.themeSelected.emit(null);
  }

  /** Open a list to view/edit it, or start a new one. */
  async openEditor(list?: WordList, event?: Event) {
    // the button sits inside a row that selects the list on click
    event?.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: WordListEditorComponent,
      componentProps: {list},
      cssClass: 'word-list-editor-modal',
    });
    await modal.present();
    const {data} = await modal.onDidDismiss<WordListEditorResult>();
    if (data?.select) {
      this.selectList(data.select);
    }
  }
}
