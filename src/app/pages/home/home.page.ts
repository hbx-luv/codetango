import {Component} from '@angular/core';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {UserService} from 'src/app/services/user.service';
import {environment} from 'src/environments/environment';
import {WordList} from 'types';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  version = environment.version;
  roomName: string;
  lists: Observable<WordList[]>;
  selectedWordList: WordList;
  userHasTyped = false;

  constructor(
      public readonly authService: AuthService,
      public readonly roomService: RoomService,
      private readonly userService: UserService,
  ) {}

  get disabled(): boolean {
    return this.roomService.getRoomId(this.roomName).length === 0;
  }

  get roomIds(): string[] {
    if (this.userService.currentUser) {
      const {rooms} = this.userService.currentUser;
      if (!this.userHasTyped) {
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
    // ion-input updates the value after the keyup event, so we need to delay
    setTimeout(() => {
      if (this.roomName) {
        this.roomService.navToRoom(this.roomName);
      }
    })
  }
}
