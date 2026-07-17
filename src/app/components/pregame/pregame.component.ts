import {Component, Input, OnChanges} from '@angular/core';
import {firstValueFrom, Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, GameType, Room, RoomStatus, Team, TeamType, ThemedWordlist, User} from '../../../../types';
import {GameService} from '../../services/game.service';
import {RoomService} from '../../services/room.service';
import {WordListsService} from '../../services/word-lists.service';

@Component({
  standalone: false,
  selector: 'app-pregame',
  templateUrl: './pregame.component.html',
  styleUrls: ['./pregame.component.scss'],
})
export class PregameComponent implements OnChanges {
  @Input() room: Room;
  @Input() game: Game;

  currentGame$: Observable<Game>;
  teams: Team[];
  constructedGame: Partial<Game>;
  debounce = 500;

  // previously-generated AI themes, offered for one-click reuse (no AI call)
  themedWordlists$: Observable<ThemedWordlist[]>;
  themeFilter = '';
  themeSort: 'newest'|'oldest'|'alpha' = 'newest';

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
  ) {
    this.themedWordlists$ = this.wordListsService.getThemedWordlists();
  }

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

  // The saved word pool for the room's current theme, if that theme has one
  // (i.e. it was previously generated). Returns undefined for a freshly-typed
  // theme that hasn't been generated/saved yet. Matching is on the normalized
  // themeKey, mirroring how the backend keys the saved pool.
  getSavedWords(themes: ThemedWordlist[], theme?: string): string[]|undefined {
    if (!theme) return undefined;
    const themeKey = theme.trim().toLowerCase();
    return themes.find(t => t.themeKey === themeKey)?.words;
  }

  // Apply the current filter text and sort order to the saved themes, always
  // floating pinned lists to the top. Array.sort is stable, so the chosen sort
  // is preserved within the pinned and unpinned groups.
  displayedThemes(themes: ThemedWordlist[]): ThemedWordlist[] {
    const query = this.themeFilter.trim().toLowerCase();
    const list = query ?
        themes.filter(t => t.theme.toLowerCase().includes(query)) :
        [...themes];

    switch (this.themeSort) {
      case 'oldest':
        list.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'alpha':
        list.sort((a, b) => a.theme.localeCompare(b.theme));
        break;
      default:  // newest
        list.sort((a, b) => b.createdAt - a.createdAt);
    }
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return list;
  }

  // Toggle a saved theme's pinned flag. Requires auth (Firestore rules gate the
  // write); pinned lists are exempt from the backend's 50-list auto-cleanup.
  async togglePin(theme: ThemedWordlist, event: Event) {
    event.stopPropagation();  // don't also select the theme
    if (!this.authService.authenticated) {
      this.utilService.showToast('Sign in to pin themes');
      return;
    }
    try {
      await this.wordListsService.setThemePinned(theme.id!, !theme.pinned);
    } catch (_e) {
      this.utilService.showToast('Could not update pin');
    }
  }

  selectWordList(wordList: string) {
    // If we're in ASSIGNING_ROLES phase and there's an existing game,
    // we need to delete the current game and create a new one to regenerate the board
    if (this.room.status === RoomStatus.ASSIGNING_ROLES && this.game) {
      this.regenerateGame({wordList});
    } else {
      // In PREGAME phase, just update the word list
      this.roomService.updateRoom(this.room.id, {wordList});
    }
  }

  async regenerateGame(updates: {wordList?: string, aiWordlistTheme?: string | null}) {
    const loader = await this.utilService.presentLoader('Regenerating board...');
    
    try {
      // Update the room's settings first
      await this.roomService.updateRoom(this.room.id, updates);

      const idToDelete = this.game?.id;
      
      // Create a new game with the same teams
      await this.gameService.createGame({
        createdAt: Date.now(),
        blueTeam: this.game.blueTeam,
        redTeam: this.game.redTeam,
        roomId: this.room.id,
      });

      // Delete the old game
      if (this.game && this.game.id) {
        await this.gameService.deleteGame(idToDelete);
      }
      
      // The room will stay in ASSIGNING_ROLES status
      await loader.dismiss();
    } catch (error) {
      await loader.dismiss();
      console.error('Error regenerating game:', error);
      this.utilService.showToast('Failed to regenerate board. Please try again.');
    }
  }

  async regenerateGameWithNewWordList(wordList: string) {
    await this.regenerateGame({wordList});
  }

  async regenerateGameWithNewTheme(theme: string) {
    await this.regenerateGame({
      aiWordlistTheme: theme,
      wordList: '',
    });
  }

  async regenerateGameWithClearedTheme() {
    await this.regenerateGame({aiWordlistTheme: null});
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
    this.lastSettings = {...this.room};
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
    const randomizedUsers = [...this.room.userIds]
        .sort(() => Math.random() - 0.5);
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

    // wait until the game has a board
    while (!this.game.tiles || this.game.tiles.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

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
        userId => firstValueFrom(this.userService.getUser(userId))));

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
      await this.applyTheme(theme);
    }
  }

  // Set the room's AI theme (used by both the free-text prompt and the
  // saved-theme picker). When a saved theme is selected, the onCreateGame
  // trigger finds its persisted word pool and skips the AI call.
  async applyTheme(theme: string) {
    // If we're in ASSIGNING_ROLES phase and there's an existing game,
    // we need to delete the current game and create a new one to regenerate the board
    if (this.room.status === RoomStatus.ASSIGNING_ROLES && this.game) {
      await this.regenerateGame({
        aiWordlistTheme: theme,
        wordList: '',
      });
    } else {
      // In PREGAME phase, just update the theme
      await this.roomService.updateRoom(this.room.id, {
        aiWordlistTheme: theme,
        wordList: '',
      });
    }
  }

  clearTheme() {
    // If we're in ASSIGNING_ROLES phase and there's an existing game,
    // we need to delete the current game and create a new one to regenerate the board
    if (this.room.status === RoomStatus.ASSIGNING_ROLES && this.game) {
      this.regenerateGame({aiWordlistTheme: null});
    } else {
      // In PREGAME phase, just clear the theme
      this.roomService.updateRoom(this.room.id, {aiWordlistTheme: null});
    }
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
