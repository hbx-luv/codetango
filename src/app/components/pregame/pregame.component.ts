import {Component, Input} from '@angular/core';
import {shuffle} from 'lodash';
import {Observable} from 'rxjs';
import {first} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {UserService} from 'src/app/services/user.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, Room, RoomStatus, Team, TeamTypes, User} from '../../../../types';
import {GameService} from '../../services/game.service';
import {RoomService} from '../../services/room.service';

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

  wordLists = [
    {url: './assets/original.png', id: 'original'},
    {url: './assets/duet.png', id: 'duetWords'},
    {url: './assets/deep-undercover.png', id: 'deepUndercover'},
    {url: './assets/pictures.png', id: 'pictures'},
  ];

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
      private readonly userService: UserService,
  ) {}

  get userInRoom(): boolean {
    return this.room && this.authService.authenticated &&
        this.room.userIds.includes(this.authService.currentUserId);
  }

  get canStartGame(): boolean {
    return this.game &&
        this.game.redTeam.userIds.includes(this.game.redTeam.spymaster) &&
        this.game.blueTeam.userIds.includes(this.game.blueTeam.spymaster);
  }

  selectWordList(wordList: string) {
    this.roomService.updateRoom(this.room.id, {wordList});
  }

  saveTimerSettings() {
    this.roomService.updateRoom(this.room.id, {
      timer: this.room.timer,
      firstTurnTimer: this.room.firstTurnTimer,
      enforceTimer: this.room.enforceTimer,
      guessIncrement: this.room.guessIncrement
    });
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
        color: TeamTypes.BLUE,
        userIds: sortedBlue,
        spymaster: sortedBlue[0],
      },
      redTeam: {
        color: TeamTypes.RED,
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
      // set spymaster to the top of the list and set timer
      await this.gameService.updateGame(this.game.id, {
        'blueTeam.userIds': this.sortSpymasterFirst(this.game.blueTeam),
        'redTeam.userIds': this.sortSpymasterFirst(this.game.redTeam),
        turnEnds: Date.now() + (timer * 1000),
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
}
