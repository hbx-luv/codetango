import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {WordList} from 'types';

import {WordListsService} from '../word-lists.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  lists: Observable<WordList[]>;

  constructor(
      private readonly wordListsService: WordListsService,
      private readonly router: Router,
  ) {
    this.lists = this.wordListsService.getWordLists();
  }

  createWords() {
    this.wordListsService.createWordList('MATT', ['THIS', 'IS', 'DANK']);
  }

  goToGame() {
    this.router.navigate(['game']);
  }
}
