import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil, tap} from 'rxjs/operators';
import {confetti} from 'src/app/confetti.js';
import {AuthService} from 'src/app/services/auth.service';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {UtilService} from 'src/app/services/util.service';
import {Clue, Game, GameStatus, Room, RoomStatus} from 'types';

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

  lastGame: string;
  lastGameStatus: GameStatus;

  constructor(
      public readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
      private readonly clueService: ClueService,
      private readonly utilService: UtilService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.currentGame$ =
        this.gameService.getCurrentGame(this.roomId).pipe(tap(currentGame => {
          if (currentGame) {
            // only change current clue subscription when you get to a new game
            if (this.lastGame !== currentGame.id) {
              delete this.lastGameStatus;
              this.lastGame = currentGame.id;
              this.currentClue$ =
                  this.clueService.getCurrentClue(currentGame.id);
            }
            // show confetti after a win for 5 seconds
            // https://www.cssscript.com/confetti-falling-animation/
            const {status} = currentGame;
            if (this.lastGameStatus && this.lastGameStatus !== status &&
                [GameStatus.BLUE_WON, GameStatus.RED_WON].includes(status)) {
              confetti.start();
              setTimeout(confetti.stop, 5000);
            }
            this.lastGameStatus = currentGame.status;
          }
        }));

    this.roomService.getRoom(this.roomId)
        .pipe(takeUntil(this.destroyed))
        .subscribe(room => {
          this.room = room;
        });
  }

  get userIsInRoom(): boolean {
    return this.isUserInRoom(this.authService.currentUserId);
  }

  get gameInProgress(): boolean {
    return this.room && [
      RoomStatus.GAME_IN_PROGRESS,
      RoomStatus.GAME_ENDED,
    ].includes(this.room.status);
  }

  get toolbarColor(): string {
    if (this.gameInProgress) {
      switch (this.lastGameStatus) {
        case GameStatus.BLUES_TURN:
        case GameStatus.BLUE_WON:
          return 'primary';
        case GameStatus.REDS_TURN:
        case GameStatus.RED_WON:
          return 'danger';
        default:
          return 'light';
      }
    }

    return 'light';
  }

  get title(): string {
    if (!this.room) return 'Loading...';

    switch (this.room.status) {
      case RoomStatus.PREGAME:
        return `${this.room.name} Lobby`;
      case RoomStatus.ASSIGNING_ROLES:
        return 'Pick Spymasters';
      default:
        switch (this.lastGameStatus) {
          case GameStatus.BLUES_TURN:
            return `Blue's Turn`;
          case GameStatus.REDS_TURN:
            return `Red's Turn`;
          case GameStatus.BLUE_WON:
            return 'Blue Wins!';
          case GameStatus.RED_WON:
            return 'Red Wins!';
          default:
            // fallback to the room name
            return this.room.name;
        }
    }
  }

  get loggedIn(): boolean {
    return this.room && this.authService.authenticated;
  }

  get showLeave(): boolean {
    return this.loggedIn && this.userIsInRoom;
  }


  leave(game: Game) {
    // remove them from the room
    this.roomService.removeUserFromRoom(
        this.room.id,
        this.authService.currentUserId,
    );
    // remove them from the game, so long as it hasn't already completed
    if (!game.completedAt) {
      this.gameService.removePlayerFromGame(
          game.id,
          this.authService.currentUserId,
      );
    }
  }

  isUserInRoom(userId: string): boolean {
    return this.room && this.room.userIds.includes(userId);
  }

  selectTab($event: string) {
    this.selectedTab = $event;
  }

  async backToLobby(game: Game) {
    let doIt = true;

    // if game is in progress, double check before proceeding
    if (!game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to pick new teams?',
          'New Teams',
          'Nevermind',
      );

      // delete this incomplete game before proceeding
      if (doIt) {
        await this.gameService.deleteGame(game.id);
      }
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

    // if game is in progress, double check before proceeding
    if (!game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to start a new game?',
          'New Game',
          'Nevermind',
      );

      // delete this incomplete game before proceeding
      if (doIt) {
        await this.gameService.deleteGame(game.id);
      }
    }

    if (doIt) {
      const loader =
          await this.utilService.presentLoader('Creating the next game...');
      const {redTeam, blueTeam, roomId} = game;

      // ensure the users are still in the room
      redTeam.userIds = redTeam.userIds.filter(this.isUserInRoom.bind(this));
      blueTeam.userIds = blueTeam.userIds.filter(this.isUserInRoom.bind(this));

      // if any team is now too small, redirect back to the pregame lobby
      if (redTeam.userIds.length < 2 || blueTeam.userIds.length < 2) {
        loader.dismiss();
        this.roomService.updateRoom(this.room.id, {status: RoomStatus.PREGAME});
        this.utilService.showToast(
            'Too many users left the room to start a new game with the same teams',
            10000);
        return;
      }

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
