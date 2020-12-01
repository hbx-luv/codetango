import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {takeUntil, tap} from 'rxjs/operators';
import {PopoverAction} from 'src/app/components/actions-popover/actions-popover.component';
import {confetti} from 'src/app/confetti.js';
import {AuthService} from 'src/app/services/auth.service';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';
import {Clue, Game, GameStatus, Room, RoomStatus} from 'types';
import {Sound, SoundService} from '../../services/sound.service';

@Component({
  selector: 'app-room',
  templateUrl: './room.page.html',
  styleUrls: ['./room.page.scss'],
})
export class RoomPage implements OnDestroy {
  private destroyed = new ReplaySubject<never>();

  selectedTab = 'board-tab';
  roomId: string;
  roomName?: string;
  room: Room;
  game: Game;
  currentClue$: Observable<Clue>;

  lastGame: string;
  lastGameStatus: GameStatus;

  actions: PopoverAction[] = [];

  constructor(
      public readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
      private readonly clueService: ClueService,
      private readonly utilService: UtilService,
      private readonly soundService: SoundService,
      private readonly userService: UserService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.roomName = this.route.snapshot.paramMap.get('name');
  }

  ionViewDidEnter() {
    // update icons when the user observable fires
    this.userService.userChanged$.pipe(takeUntil(this.destroyed))
        .subscribe(this.setActions.bind(this));

    this.gameService.getCurrentGame(this.roomId)
        .pipe(takeUntil(this.destroyed))
        .subscribe(currentGame => {
          this.game = currentGame;
          this.setActions();

          if (currentGame) {
            // only change current clue subscription when you get to a new game
            if (this.lastGame !== currentGame.id) {
              delete this.lastGameStatus;
              this.lastGame = currentGame.id;
              this.currentClue$ =
                  this.clueService.getCurrentClue(currentGame.id);
            }
            // detect game over
            const {status} = currentGame;
            if (this.userIsInRoom && this.lastGameStatus &&
                this.lastGameStatus !== status &&
                [GameStatus.BLUE_WON, GameStatus.RED_WON].includes(status)) {
              const blueWonIWon = status === GameStatus.BLUE_WON &&
                  currentGame.blueTeam.userIds.includes(
                      this.authService.currentUserId);
              const redWonIWon = status === GameStatus.RED_WON &&
                  currentGame.redTeam.userIds.includes(
                      this.authService.currentUserId);

              // play a win/lose sound when the game ends
              if (blueWonIWon || redWonIWon) {
                this.soundService.play(Sound.WIN);
              } else {
                this.soundService.play(Sound.LOSE);
              }

              // show confetti after a win/loss for 5 seconds
              // https://www.cssscript.com/confetti-falling-animation/
              // TODO: maybe do a separate animation for losers (other than
              // confetti)
              confetti.start();
              setTimeout(confetti.stop, 5000);
            }
            this.lastGameStatus = currentGame.status;
          }
        });

    this.subscribeToRoom();
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
    if (!this.room) {
      return 'Loading...';
    }

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

  setActions() {
    const actions = [];

    if (this.userIsInRoom) {
      if (this.gameInProgress) {
        actions.push(
            {
              label: this.soundService.muted() ? 'Unmute Sounds' :
                                                 'Mute Sounds',
              icon: this.soundService.muted() ? 'volume-mute-outline' :
                                                'volume-high-outline',
              onClick: this.toggleSound.bind(this),
            },
            {
              label: 'New Teams',
              icon: 'people-outline',
              onClick: this.backToLobby.bind(this),
            },
            {
              label: 'Next Game',
              icon: 'play-skip-forward-outline',
              onClick: this.nextGame.bind(this),
            },
        )
      }
      if (this.loggedIn) {
        actions.push({
          label: 'Leave',
          icon: 'exit-outline',
          onClick: this.leave.bind(this),
        });
      }
    }

    this.actions = actions;
  }

  subscribeToRoom() {
    this.roomService.getRoom(this.roomId)
        .pipe(takeUntil(this.destroyed))
        .subscribe(async room => {
          this.room = room;
          this.setActions();

          // if this room doesn't exist, create a new room with the id
          if (!room.exists) {
            const id = await this.roomService.createRoom({id: room.id});
            this.roomService.navToRoom(id);
          }
        });
  }

  leave() {
    // remove them from the room
    this.roomService.removeUserFromRoom(
        this.room.id,
        this.authService.currentUserId,
    );
    // remove them from the game, so long as it hasn't already completed
    if (!this.game.completedAt) {
      this.gameService.removePlayerFromGame(
          this.game.id,
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

  toggleSound() {
    this.soundService.toggleMute();
    this.setActions();
  }

  async backToLobby() {
    let doIt = true;

    // if game is in progress, double check before proceeding
    if (!this.game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to pick new teams?',
          'This game will be abandoned and everyone will be redirected back to the lobby.',
          'New Teams',
          'Nevermind',
      );

      // delete this incomplete game before proceeding
      if (doIt) {
        await this.gameService.deleteGame(this.game.id);
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

  async nextGame() {
    let doIt = true;

    // if game is in progress, double check before proceeding
    if (!this.game.completedAt) {
      doIt = await this.utilService.confirm(
          'Are you sure you want to start a new game?',
          'This game will be abandoned, but the teams will remain the same.',
          'New Game',
          'Nevermind',
      );

      // delete this incomplete game before proceeding
      if (doIt) {
        await this.gameService.deleteGame(this.game.id);
      }
    }

    if (doIt) {
      const loader =
          await this.utilService.presentLoader('Creating the next game...');
      const {redTeam, blueTeam, roomId} = this.game;

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
