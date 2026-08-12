import {Component, Input, OnChanges, OnDestroy} from '@angular/core';
import {Subscription} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';
import {BotService} from 'src/app/services/bot.service';
import {GameService} from 'src/app/services/game.service';
import {RoomPresenceService, RoomWatchers} from 'src/app/services/room-presence.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, Room, RoomStatus} from '../../../../types';
import {RoomService} from '../../services/room.service';

@Component({
  standalone: false,
  selector: 'app-team-lists',
  templateUrl: './team-lists.component.html',
  styleUrls: ['./team-lists.component.scss'],
})
export class TeamListsComponent implements OnChanges, OnDestroy {
  @Input() room: Room;
  @Input() game: Game;
  @Input() setSpymaster: boolean;
  @Input() showScore = false;

  // signed-in viewers of the page who aren't on either team
  spectatorIds: string[] = [];
  // signed-out viewers of the page (aggregate count)
  anonymousWatchers = 0;
  // latest presence snapshot, kept so the spectator list can be refiltered
  // the instant team membership changes rather than on the next presence tick
  private watchers: RoomWatchers = {userIds: [], anonymous: 0};
  private watchersRoomId = '';
  private watchersSub?: Subscription;

  constructor(
      private readonly authService: AuthService,
      private readonly botService: BotService,
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly utilService: UtilService,
      private readonly roomPresence: RoomPresenceService,
  ) {}

  ngOnChanges() {
    if (this.room?.id && this.room.id !== this.watchersRoomId) {
      this.watchersRoomId = this.room.id;
      this.watchersSub?.unsubscribe();
      this.watchersSub = this.roomPresence.watchers(this.room.id)
                             .subscribe(watchers => {
                               this.watchers = watchers;
                               this.updateSpectators();
                             });
    }

    // team changes (a spectator joins / a player is removed) must refilter
    // the spectator list immediately, not wait for the next presence emission
    this.updateSpectators();
  }

  /** Spectators are anyone with the page open who isn't on a team. */
  private updateSpectators() {
    this.spectatorIds =
        this.watchers.userIds.filter(id => !this.isOnATeam(id));
    this.anonymousWatchers = this.watchers.anonymous;
  }

  /** Whether the "Add bot" button should show for a team. */
  get canAddBot(): boolean {
    return this.game && !this.game.completedAt &&
        this.room?.status === RoomStatus.ASSIGNING_ROLES &&
        this.loggedInAndInRoom;
  }

  /** Seat a bot on the team immediately (direct client-side write). */
  addBot(team: 'redTeam'|'blueTeam') {
    this.botService.addBotToTeam(this.game, team);
  }

  /** Whether a user occupies a seat on either team */
  private isOnATeam(userId: string): boolean {
    return !!this.game &&
        (this.game.blueTeam.userIds.includes(userId) ||
         this.game.redTeam.userIds.includes(userId));
  }

  ngOnDestroy() {
    this.watchersSub?.unsubscribe();
  }

  get loggedInAndInRoom(): boolean {
    return this.isLoggedIn && this.room && this.isInRoom;
  }

  get isInRoom(): boolean {
    return this.room.userIds.includes(this.authService.currentUserId);
  }

  get isLoggedIn(): boolean {
    return this.authService.authenticated;
  }

  get notOnATeamYet(): boolean {
    return this.game &&
        !this.game.redTeam.userIds.includes(this.authService.currentUserId) &&
        !this.game.blueTeam.userIds.includes(this.authService.currentUserId);
  }

  showJoinButton(team: 'redTeam'|'blueTeam') {
    return this.game && !this.game.completedAt &&
        (this.canSwapTeams(team) || this.notOnATeamYet);
  }

  canSwapTeams(team: 'redTeam'|'blueTeam'): boolean {
    return this.game && this.room.status === RoomStatus.ASSIGNING_ROLES &&
        !this.game[team].userIds.includes(this.authService.currentUserId);
  }

  userClicked(userId: string, team: 'redTeam'|'blueTeam') {
    if (this.setSpymaster) {
      this.assignSpymaster(userId, team);
    }
  }

  async assignSpymaster(userId: string, team: 'redTeam'|'blueTeam') {
    let proceed = true;

    // when not in the set spymaster phase, confirm the change of spymaster
    if (!this.setSpymaster) {
      proceed = await this.utilService.confirm(
          'Change Spymaster?',
          'Are you sure you want to change the spymaster in the middle of a game?',
          'Set Spymaster', 'Nevermind');
    }

    if (proceed) {
      this.gameService.assignSpymaster(this.game.id, userId, team);
    }
  }

  async remove(userId: string, team: 'redTeam'|'blueTeam') {
    let proceed = true;

    // when not in the set spymaster phase, confirm the removal
    if (!this.setSpymaster) {
      proceed = await this.utilService.confirm(
          'Remove Player?',
          'Are you sure you want to remove this player in the middle of a game?',
          'Remove', 'Nevermind');
    }

    // quit early if they choose nevermind
    if (!proceed) return;

    this.gameService.removePlayerFromGame(this.game.id, userId);

    // in the case that the player being removed is the current spymaster,
    // delete the spymaster field
    const thisTeam = this.game[team];
    if (userId === thisTeam.spymaster) {
      thisTeam.spymaster = null;
    }
  }

  async joinTeam(team: 'redTeam'|'blueTeam') {
    if (!this.isLoggedIn) {
      await this.authService.loginWithGoogle();
    }

    if (!this.isInRoom) {
      this.roomService.joinRoom(this.room.id);
    }

    this.gameService.addPlayerToTeam(
        this.game.id,
        this.authService.currentUserId,
        team,
    );
  }
}
