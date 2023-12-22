import {Component, Input} from '@angular/core';
import {clone, shuffle} from 'lodash';
import {Observable} from 'rxjs';
import {first} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, GameType, Room, RoomStatus, Team, TeamType, User} from '../../../../types';
import {GameService} from '../../services/game.service';
import {RoomService} from '../../services/room.service';
import {WordListsService} from '../../services/word-lists.service';

@Component({
  selector: 'app-pregame',
  templateUrl: './pregame.component.html',
  styleUrls: ['./pregame.component.scss'],
})
export class PregameComponent {
  @Input() room: Room;
  @Input() game: Game;

  currentGame$: Observable<Game>;
  teams: Team[];
  constructedGame: Partial<Game>;
  debounce = 500;

  lastSettings: Partial<Room>;

  wordLists = [
    {url: './assets/original.png', id: 'original'},
    {url: './assets/emojis.png', id: 'emojis'},
    {url: './assets/memes.png', id: 'memes'},
    {url: './assets/pictures.png', id: 'pictures'},
    {url: './assets/technology-words.png', id: 'technologyWords'},
    {url: './assets/emoji-remix.png', id: 'emoji-remix'},
  ];

  hiddenWordLists = [
    {
      url: './assets/deep-undercover.png',
      id: 'deepUndercover',
      warning: 'Note: This version is NSFW. We advise playing with adults only.'
    },
    {url: './assets/pop-culture-words.png', id: 'popCultureWords'},
    {url: './assets/halloween.png', id: 'halloween'},
    {url: './assets/tv-words.png', id: 'tvWords'},
    {url: './assets/winter.png', id: 'winter'},
    {url: './assets/thanksgiving-words.png', id: 'thanksgiving'},
  ];

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
      private readonly userService: UserService,
      private readonly wordListsService: WordListsService,
  ) {}

  ngOnChanges() {
    const {redReady = false, blueReady = false} = this.room || {};

    // if both red and blue are ready, have red start the game and set those
    // statuses back to false
    if (redReady && blueReady && this.redSpymaster) {
      this.startGame().then(() => {
        this.roomService.updateRoom(this.room.id, {
          redReady: false,
          blueReady: false,
        });
      });
    }
  }

  get userInRoom(): boolean {
    return this.room && this.authService.authenticated &&
        this.room.userIds.includes(this.authService.currentUserId);
  }

  get canStartGame(): boolean {
    return this.game &&
        this.game.redTeam.userIds.includes(this.game.redTeam.spymaster) &&
        this.game.blueTeam.userIds.includes(this.game.blueTeam.spymaster);
  }

  get redSpymaster(): boolean {
    return this.userInRoom &&
        this.game?.redTeam.spymaster === this.authService.currentUserId;
  }

  get blueSpymaster(): boolean {
    return this.userInRoom &&
        this.game?.blueTeam.spymaster === this.authService.currentUserId;
  }

  get hasCustomTheme(): boolean {
    return !!this.room?.aiWordlistTheme;
  }

  selectWordList(wordList: string) {
    this.roomService.updateRoom(this.room.id, {wordList});
  }

  saveTimerSettings() {
    const updates: Partial<Room> = {};
    const {timer, firstTurnTimer, enforceTimer, guessIncrement} =
        this.lastSettings ?? this.room ?? {};

    // only update what's changed
    if (this.room.timer !== timer) {
      updates.timer = this.room.timer;
    }
    if (this.room.firstTurnTimer !== firstTurnTimer) {
      updates.firstTurnTimer = this.room.firstTurnTimer;
    }
    if (this.room.enforceTimer !== enforceTimer) {
      updates.enforceTimer = this.room.enforceTimer;
    }
    if (this.room.guessIncrement !== guessIncrement) {
      updates.guessIncrement = this.room.guessIncrement;
    }

    this.roomService.updateRoom(this.room.id, updates);
    this.lastSettings = clone(this.room);
  }

  removeUser(userId: string) {
    this.roomService.removeUserFromRoom(this.room.id, userId);
  }

  goBackToLobby(game: Game) {
    // delete this game when going back, since it (most likely) has not been
    // completed yet (but we still check completedAt)
    if (!this.game.completedAt) {
      this.gameService.deleteGame(game.id);
    }
    this.roomService.updateRoom(this.room.id, {status: RoomStatus.PREGAME});
  }

  async assignUsersToRandomTeams() {
    const roomSize = this.room.userIds.length;
    const halfway = Math.ceil(roomSize / 2);
    const randomizedUsers = shuffle(this.room.userIds);
    const blueTeamUsers = randomizedUsers.slice(0, halfway);
    const redTeamUsers = randomizedUsers.slice(halfway);

    // sort the users by their spymaster frequency so that users who have been
    // spymaster the least (compared to games played) will be chosen first
    const sortedBlue = await this.sortUsersBySpymasterFrequency(blueTeamUsers);
    const sortedRed = await this.sortUsersBySpymasterFrequency(redTeamUsers);

    // wait for the game to be created
    const loader = await this.utilService.presentLoader('Creating game...');
    await this.gameService.createGame({
      createdAt: Date.now(),
      blueTeam: {
        color: TeamType.BLUE,
        userIds: sortedBlue,
        spymaster: sortedBlue[0],
      },
      redTeam: {
        color: TeamType.RED,
        userIds: sortedRed,
        spymaster: sortedRed[0],
      },
      roomId: this.room.id,
    });

    // move the room to the next state
    await this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.ASSIGNING_ROLES,
    });
    await loader.dismiss();
  }

  async startGame() {
    const loader = await this.utilService.presentLoader('Starting game...');
    await this.roomService.updateRoom(this.room.id, {
      status: RoomStatus.GAME_IN_PROGRESS,
    });
    const timer = this.room.firstTurnTimer || this.room.timer;
    if (timer) {
      const gameType = this.wordListsService.getGameType(this.room.wordList);
      const hasPictures =
          (gameType === GameType.PICTURES || gameType === GameType.MEMES);
      // set spymaster to the top of the list and set timer
      await this.gameService.updateGame(this.game.id, {
        'blueTeam.userIds': this.sortSpymasterFirst(this.game.blueTeam),
        'redTeam.userIds': this.sortSpymasterFirst(this.game.redTeam),
        'turnEnds': Date.now() + (timer * 1000),
        'gameType': gameType,
        'hasPictures': hasPictures,
      });
    }
    await loader.dismiss();
  }

  async joinRoom() {
    if (!this.authService.authenticated) {
      await this.authService.loginWithGoogle();
    }

    this.roomService.joinRoom(this.room.id);
  }

  sortSpymasterFirst(team: Team) {
    const {userIds, spymaster} = team;
    return userIds.sort(user => user === spymaster ? -1 : 0);
  }

  async sortUsersBySpymasterFrequency(userIds: string[]): Promise<string[]> {
    const users: User[] = await Promise.all(userIds.map(
        userId => this.userService.getUser(userId).pipe(first()).toPromise()));

    return users
        .sort((a, b) => {
          if (!a.stats) {
            return -1;
          } else if (!b.stats) {
            return 1;
          } else {
            return (a.stats.spymasterGames / a.stats.gamesPlayed) -
                (b.stats.spymasterGames / b.stats.gamesPlayed);
          }
        })
        .map(user => user.id!);
  }

  async promptForTheme() {
    const theme = await this.utilService.promptForText(
        'Custom Theme',
        'Enter a theme for this game, we\'ll generate a board based on your theme.',
        'e.g. Pop culture, movies, and music',
        'Save',
        'Cancel',
    );

    if (theme) {
      await this.roomService.updateRoom(this.room.id, {aiWordlistTheme: theme});
    }
  }

  clearTheme() {
    this.roomService.updateRoom(this.room.id, {aiWordlistTheme: null});
  }

  toggleRedReady() {
    if (this.room?.id) {
      this.roomService.updateRoom(this.room.id, {
        redReady: !this.room.redReady,
      });
    }
  }

  toggleBlueReady() {
    if (this.room?.id) {
      this.roomService.updateRoom(this.room.id, {
        blueReady: !this.room.blueReady,
      });
    }
  }
}
