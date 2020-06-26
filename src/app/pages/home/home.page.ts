import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
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
      if (!this.authService.authenticated) {
        await this.authService.loginWithGoogle();
      }

      const id = await this.roomService.createRoom({
        name: this.roomName,
        status: RoomStatus.PREGAME,
        timer: 120,
        firstTurnTimer: 180,
        enforceTimer: false,
        userIds: []
      });
      this.router.navigate(['room', id]);
    }
  }
}
