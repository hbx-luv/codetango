import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil, tap} from 'rxjs/operators';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {ClueService} from 'src/app/services/clue.service';
import {Game, Room, RoomStatus, Clue} from 'types';

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
  currentClue$: Observable<Clue>;

  constructor(
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
      private readonly clueService: ClueService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.currentGame$ = this.gameService.getCurrentGame(this.roomId).pipe(tap(currentGame => {
      this.currentClue$ = this.clueService.getCurrentClue(currentGame.id);
    }));

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
