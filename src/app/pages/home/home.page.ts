import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';
import {RoomStatus, WordList} from 'types';

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
      public readonly authService: AuthService,
      private readonly roomService: RoomService,
      private readonly router: Router,
      private readonly utilService: UtilService,
      private readonly userService: UserService,
  ) {}

  get disabled(): boolean {
    return this.roomService.createRoomId(this.roomName).length === 0;
  }

  get roomIds(): string[] {
    if (this.userService.currentUser) {
      const {rooms} = this.userService.currentUser;
      if (!this.roomName) {
        // An ExpressionChangedAfterItHasBeenCheckedError expection is thrown if
        // there is no timeout here
        // https://blog.angular-university.io/angular-debugging/
        setTimeout(() => {
          this.roomName = rooms[0];
        });
      }
      return rooms.slice(0, 5);
    } else {
      return [];
    }
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

      this.joinRoom(id);
      await loader.dismiss();
    }
  }

  joinRoom(id: string) {
    this.roomService.joinRoom(id);
    this.router.navigate([id]);
  }
}
