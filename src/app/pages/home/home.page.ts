import {Component, OnDestroy} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {RoomService} from 'src/app/services/room.service';
import {UserService} from 'src/app/services/user.service';
import {environment} from 'src/environments/environment';
import {User, WordList} from 'types';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnDestroy {
  private destroyed$ = new ReplaySubject<void>();

  version = environment.version;
  roomName: string;
  lists: Observable<WordList[]>;
  selectedWordList: WordList;
  userHasTyped = false;
  roomIds: string[] = [];

  constructor(
      public readonly authService: AuthService,
      public readonly roomService: RoomService,
      private readonly userService: UserService,
  ) {}

  ionViewDidEnter() {
    if (this.userService.currentUser) {
      this.setRoomIds(this.userService.currentUser);
    }

    this.userService.userChanged$.pipe(takeUntil(this.destroyed$))
        .subscribe(user => {
          if (user) {
            this.setRoomIds(user);
          }
        });
  }

  get disabled(): boolean {
    return this.roomService.getRoomId(this.roomName).length === 0;
  }

  setRoomIds(user: User) {
    const {rooms} = user;
    this.roomIds = rooms.slice(0, 5);

    // if the user hasn't already started typing in the input, replace it with
    // the last room they were in for quick access
    if (!this.userHasTyped) {
      this.roomName = rooms[0];
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

  ngOnDestroy() {
    this.destroyed$.next();
  }
}
