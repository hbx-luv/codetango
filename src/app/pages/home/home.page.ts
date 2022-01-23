import {Component, OnDestroy} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {RoomService} from 'src/app/services/room.service';
import {UserService} from 'src/app/services/user.service';
import {environment} from 'src/environments/environment';
import {User, WordList} from 'types';

const LOCALSTORAGE_ROOMS = 'CODETANGO_LOCALSTORAGE_ROOMS';
const LOCALSTORAGE_USER_ID = 'CODETANGO_LOCALSTORAGE_USER_ID';

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
  
  // load these from cache initially
  roomIds: string[] = this.getLocalStorage(LOCALSTORAGE_ROOMS, []);
  userId: string = this.getLocalStorage(LOCALSTORAGE_USER_ID, undefined);

  constructor(
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
            this.userId = user.id;
            this.setLocalStorage(LOCALSTORAGE_USER_ID, this.userId);

            this.setRoomIds(user);
          } else {
            delete this.userId;
            delete this.roomIds;
          }
        });
  }

  get tesla(): boolean {
    return navigator?.userAgent?.includes('Tesla');
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

    // cache
    this.setLocalStorage(LOCALSTORAGE_ROOMS, this.roomIds);
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

  fullscreen() {
    location.href = 'https://youtube.com/redirect?q=https://play.hbx.vision';
  }

  getLocalStorage(key: string, defaultValue: any) {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? defaultValue;
  }

  setLocalStorage(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }
}
