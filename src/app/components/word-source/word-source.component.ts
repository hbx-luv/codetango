import {Component, Input} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {firstValueFrom} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {UtilService} from 'src/app/services/util.service';
import {WordListsService} from 'src/app/services/word-lists.service';
import {Game, WORD_LIST_LIMITS, WordSourceType} from 'types';

import {WordListEditorComponent} from '../word-list-editor/word-list-editor.component';

/**
 * One line saying where a game's board came from — a default list, a saved
 * list, or an AI theme (with its prompt) — and, for AI boards, a way to keep
 * the generated words as a reusable list. Renders nothing for games from
 * before the source was recorded.
 */
@Component({
  standalone: false,
  selector: 'app-word-source',
  templateUrl: './word-source.component.html',
  styleUrls: ['./word-source.component.scss'],
})
export class WordSourceComponent {
  @Input() game: Game;
  // just the label, no actions (for dense places like game cards)
  @Input() compact = false;

  readonly Type = WordSourceType;
  saving = false;

  constructor(
      readonly authService: AuthService,
      private readonly wordListsService: WordListsService,
      private readonly utilService: UtilService,
      private readonly modalCtrl: ModalController,
  ) {}

  get source() {
    return this.game?.wordSource;
  }

  get icon(): string {
    switch (this.source?.type) {
      case WordSourceType.AI:
        return 'sparkles';
      case WordSourceType.SAVED:
        return 'list-outline';
      default:
        return 'albums-outline';
    }
  }

  /** An AI board whose words nobody has saved yet. */
  get canSave(): boolean {
    return !this.compact && this.source?.type === WordSourceType.AI &&
        !this.source.listId && !!this.source.pool?.length &&
        this.authService.authenticated;
  }

  /** A player-made list we can open (it may have been deleted since). */
  get canOpen(): boolean {
    return !this.compact && !!this.source?.listId &&
        this.source.type !== WordSourceType.BUILT_IN;
  }

  async save() {
    const name = await this.utilService.promptForText(
        'Save word list',
        `Keep all ${this.source.pool.length} words generated for this theme as a list anyone can play again.`,
        'List name', 'Save', 'Cancel',
        this.source.prompt.slice(0, WORD_LIST_LIMITS.nameLength));
    if (!name?.trim()) {
      return;
    }
    this.saving = true;
    try {
      await this.wordListsService.saveFromGame(this.game, name.trim());
      this.utilService.showToast(
          'Saved — find it under Community when picking a word list');
    } catch (e) {
      console.error('Error saving word list from game:', e);
      this.utilService.showToast('Couldn\'t save the list. Please try again.');
    } finally {
      this.saving = false;
    }
  }

  async open() {
    const library = await firstValueFrom(this.wordListsService.library$);
    const list = library.find(l => l.id === this.source.listId);
    if (!list) {
      this.utilService.showToast('This list has since been deleted');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: WordListEditorComponent,
      componentProps: {list},
      cssClass: 'word-list-editor-modal',
    });
    await modal.present();
  }
}
