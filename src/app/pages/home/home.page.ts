import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {UtilService} from 'src/app/services/util.service';
import {RoomStatus, WordList} from 'types';

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
      private readonly roomService: RoomService,
      private readonly wordListsService: WordListsService,
      public readonly authService: AuthService,
      private readonly router: Router,
      private readonly utilService: UtilService,
  ) {
    this.lists = this.wordListsService.getWordLists().pipe(tap(wordLists => {
      if (!this.selectedWordList && wordLists && wordLists.length) {
        this.selectedWordList = wordLists[0];
      }
    }));
  }

  selectWordList(list: WordList) {
    this.selectedWordList = list;
  }

  async createRoom() {
    if (this.roomName) {
      let loader;
      if (!this.authService.authenticated) {
        loader = await this.utilService.presentLoader('Logging in...');
        await this.authService.loginWithGoogle();
        await loader.dismiss();
      }

      loader = await this.utilService.presentLoader('Joining room...');
      const id = await this.roomService.createRoom({
        name: this.roomName,
        status: RoomStatus.PREGAME,
        timer: 120,
        firstTurnTimer: 180,
        guessIncrement: 30,
        wordList: 'original',
        enforceTimer: false,
        userIds: []
      });

      await this.roomService.joinRoom(id);
      this.router.navigate([id]);
      await loader.dismiss();
    }
  }
}
