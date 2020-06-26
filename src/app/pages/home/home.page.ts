import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {WordList} from 'types';

import {WordListsService} from '../../services/word-lists.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  roomName: string;
  lists: Observable<WordList[]>;
  selectedWordList: WordList;

  constructor(
      private readonly wordListsService: WordListsService,
      private readonly router: Router,
  ) {
    this.lists = this.wordListsService.getWordLists().pipe(tap(wordLists => {
      if (!this.selectedWordList && wordLists && wordLists.length) {
        this.selectedWordList = wordLists[0];
      }
    }));
  }

  get buttonAction(): string {
    // TODO: maybe someday show 'Create' or 'Join' as they change the text in
    // the input box
    return 'GO';
  }

  selectWordList(list: WordList) {
    this.selectedWordList = list;
  }

  createRoom() {
    // TODO: actually create a room
    this.router.navigate(['room']);
  }
}
