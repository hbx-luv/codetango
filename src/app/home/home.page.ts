import {Component} from '@angular/core';
import {WordListsService} from '../word-lists.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  constructor(
      private readonly wordListsService: WordListsService,
  ) {}

  createWords() {
    this.wordListsService.createWordList('MATT', ['THIS', 'IS', 'DANK']);
  }
}
