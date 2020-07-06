import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil, tap} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {UtilService} from 'src/app/services/util.service';
import {Clue, Game, Room, RoomStatus} from 'types';

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
      private readonly utilService: UtilService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.currentGame$ =
        this.gameService.getCurrentGame(this.roomId).pipe(tap(currentGame => {
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

  async backToLobby(game: Game) {
    let doIt = true;

    // if game is in progress, doouble check before proceeding
    if (!game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to pick new teams?',
          'New Teams',
          'Nevermind',
      );
    }

    if (doIt) {
      const loader = await this.utilService.presentLoader('Redirecting...');
      await this.roomService.updateRoom(this.room.id, {
        status: RoomStatus.PREGAME,
      });
      await loader.dismiss();
    }
  }

  async nextGame(game: Game) {
    let doIt = true;

    // if game is in progress, doouble check before proceeding
    if (!game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to start a new game?',
          'New Game',
          'Nevermind',
      );
    }

    if (doIt) {
      const loader =
          await this.utilService.presentLoader('Creating the next game...');
      const {redTeam, blueTeam, roomId} = game;

      // cycle the current spymaster to the end and set new ones
      redTeam.userIds.push(redTeam.userIds.shift());
      blueTeam.userIds.push(blueTeam.userIds.shift());
      redTeam.spymaster = redTeam.userIds[0];
      blueTeam.spymaster = blueTeam.userIds[0];

      await this.gameService.createGame({redTeam, blueTeam, roomId});
      await this.roomService.updateRoom(
          roomId, {status: RoomStatus.ASSIGNING_ROLES});
      await loader.dismiss();
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
