import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {ACCEPTED_IMAGE_TYPES, ImageStoreService} from 'src/app/services/image-store.service';
import {UtilService} from 'src/app/services/util.service';
import {WordListsService} from 'src/app/services/word-lists.service';
import {GameType, tileCountFor, WORD_LIST_LIMITS, WordList} from 'types';

import {isImageLink} from '../game/tile-util';

interface ImageItem {
  // what gets saved: a link, or an upload ref once it's stored
  ref?: string;
  // a picked file waiting to be uploaded on save, and its local preview
  blob?: Blob;
  preview?: string;
  // the link didn't load
  broken?: boolean;
}

/** What the modal resolves with when it changed something. */
export interface WordListEditorResult {
  // the list to switch the room to
  select?: string;
  deleted?: string;
}

/**
 * Create, edit or just look at a player-made list. Anyone can open any
 * list; only its owner gets the editing controls.
 */
@Component({
  standalone: false,
  selector: 'app-word-list-editor',
  templateUrl: './word-list-editor.component.html',
  styleUrls: ['./word-list-editor.component.scss'],
})
export class WordListEditorComponent implements OnInit, OnDestroy {
  // the list to open; leave unset to create a new one
  @Input() list?: WordList;

  readonly GameType = GameType;
  readonly limits = WORD_LIST_LIMITS;
  readonly acceptedImageTypes = ACCEPTED_IMAGE_TYPES;

  editable = true;
  name = '';
  description = '';
  gameType = GameType.WORDS;
  wordsText = '';
  images: ImageItem[] = [];
  linksText = '';
  dragging = false;
  saving = false;
  // "3 / 12" while uploads are in flight
  uploadProgress = '';

  constructor(
      readonly authService: AuthService,
      private readonly modalCtrl: ModalController,
      private readonly wordListsService: WordListsService,
      private readonly imageStore: ImageStoreService,
      private readonly utilService: UtilService,
  ) {}

  ngOnInit() {
    if (this.list) {
      this.editable = this.wordListsService.canEdit(this.list);
      this.name = this.list.name;
      this.description = this.list.description ?? '';
      this.gameType = this.list.gameType ?? GameType.WORDS;
      if (this.isImages) {
        this.images = this.list.words.map(ref => ({ref}));
      } else {
        this.wordsText = this.list.words.join('\n');
      }
    }
  }

  ngOnDestroy() {
    this.images.forEach(image => this.release(image));
  }

  get isNew(): boolean {
    return !this.list;
  }

  get isImages(): boolean {
    return this.gameType === GameType.IMAGES;
  }

  /** The textarea's contents as clean, unique, board-ready words. */
  get words(): string[] {
    const seen = new Set<string>();
    return this.wordsText.split(/[\n,]/)
        .map(word => word.trim().toUpperCase())
        .filter(word => {
          if (!word || word.length > this.limits.wordLength || seen.has(word)) {
            return false;
          }
          seen.add(word);
          return true;
        });
  }

  get count(): number {
    return this.isImages ? this.images.length : this.words.length;
  }

  get minimum(): number {
    return tileCountFor(this.gameType);
  }

  get noun(): string {
    return this.isImages ? 'image' : 'word';
  }

  get brokenCount(): number {
    return this.images.filter(image => image.broken).length;
  }

  /** Why the list can't be saved yet, or '' when it's good to go. */
  get problem(): string {
    if (!this.name.trim()) {
      return 'Give your list a name';
    }
    if (this.count < this.minimum) {
      const missing = this.minimum - this.count;
      return `Add ${missing} more ${this.noun}${missing === 1 ? '' : 's'} — a board needs ${this.minimum}`;
    }
    if (this.count > this.limits.maxItems) {
      return `That's too many — the limit is ${this.limits.maxItems}`;
    }
    if (this.isImages && this.brokenCount) {
      return `Remove the ${this.brokenCount === 1 ? 'link' : `${this.brokenCount} links`} that didn't load`;
    }
    return '';
  }

  // ---- images ----

  async addFiles(files: FileList|File[]|null) {
    for (const file of Array.from(files ?? [])) {
      try {
        const blob = await this.imageStore.prepare(file);
        this.images.push({blob, preview: URL.createObjectURL(blob)});
      } catch (e) {
        this.utilService.showToast((e as Error).message, 4000);
      }
    }
  }

  onFilesPicked(input: HTMLInputElement) {
    this.addFiles(input.files);
    // let the same file be picked again after it's removed
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    const {files} = event.dataTransfer ?? {};
    if (files?.length) {
      this.addFiles(files);
    } else {
      // an image dragged straight out of another browser tab arrives as a URL
      this.addLinks(event.dataTransfer?.getData('text/uri-list') ?? '');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging = true;
  }

  addLinksFromInput() {
    // whatever couldn't be added stays in the box to be fixed
    this.linksText = this.addLinks(this.linksText).join('\n');
  }

  /** Add every https link found in the text; returns the entries it refused. */
  private addLinks(text: string): string[] {
    const existing = new Set(this.images.map(image => image.ref));
    const rejected: string[] = [];
    for (const link of text.split(/\s+/).filter(Boolean)) {
      if (!isImageLink(link) || link.length > this.limits.imageRefLength) {
        rejected.push(link);
      } else if (!existing.has(link)) {
        existing.add(link);
        this.images.push({ref: link});
      }
    }
    if (rejected.length) {
      this.utilService.showToast(
          `${rejected.length === 1 ? 'That isn\'t' : `${rejected.length} of those aren't`} an https:// image link`,
          4000);
    }
    return rejected;
  }

  removeImage(index: number) {
    this.release(this.images.splice(index, 1)[0]);
  }

  private release(image: ImageItem) {
    if (image.preview) {
      URL.revokeObjectURL(image.preview);
    }
  }

  // ---- actions ----

  async save() {
    if (this.problem || this.saving) {
      return;
    }
    this.saving = true;
    try {
      const draft = {
        name: this.name,
        description: this.description,
        gameType: this.gameType,
        words: this.isImages ? await this.uploadImages() : this.words,
        prompt: this.list?.prompt,
      };
      if (this.list) {
        await this.wordListsService.updateList(this.list.id, draft);
        this.dismiss();
      } else {
        // a freshly made list is almost always the one they want to play
        this.dismiss({select: await this.wordListsService.createList(draft)});
      }
    } catch (e) {
      console.error('Error saving word list:', e);
      this.utilService.showToast('Couldn\'t save the list. Please try again.');
    } finally {
      this.saving = false;
      this.uploadProgress = '';
    }
  }

  /** Store any files that haven't been uploaded yet; returns every ref. */
  private async uploadImages(): Promise<string[]> {
    const pending = this.images.filter(image => !image.ref);
    let done = 0;
    for (const image of pending) {
      this.uploadProgress = `${++done} / ${pending.length}`;
      image.ref = await this.imageStore.upload(image.blob);
    }
    return this.images.map(image => image.ref);
  }

  async delete() {
    const confirmed = await this.utilService.confirm(
        'Delete list',
        `Delete "${this.list.name}"? Games already played with it keep their boards.`,
        'Delete', 'Cancel');
    if (confirmed) {
      await this.wordListsService.deleteList(this.list.id);
      this.dismiss({deleted: this.list.id});
    }
  }

  use() {
    this.dismiss({select: this.list.id});
  }

  dismiss(result?: WordListEditorResult) {
    this.modalCtrl.dismiss(result);
  }
}
