import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {Game, Room, RoomStatus} from 'types';

@Component({
  selector: 'app-room',
  templateUrl: './room.page.html',
  styleUrls: ['./room.page.scss'],
})
export class RoomPage implements OnDestroy {
  private destroyed = new ReplaySubject<never>();

  selectedTab = 'board-tab';
  roomId: string;
  room: Room;
  currentGame$: Observable<Game>;

  constructor(
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.currentGame$ = this.gameService.getCurrentGame(this.roomId);

    this.roomService.getRoom(this.roomId)
        .pipe(takeUntil(this.destroyed))
        .subscribe(room => {
          this.room = room;
        });
  }

  get gameInProgress(): boolean {
    return this.room && [
      RoomStatus.GAME_IN_PROGRESS,
      RoomStatus.GAME_ENDED,
    ].includes(this.room.status);
  }

  selectTab($event: string) {
    console.log($event);
    this.selectedTab = $event;
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
