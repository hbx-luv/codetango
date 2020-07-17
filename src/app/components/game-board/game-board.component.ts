import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {get} from 'lodash';

import {Clue, Game, GameStatus, Room, TeamTypes, Tile, TileRole} from '../../../../types';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent {
  // readonly versions of the game board won't user the room
  @Input() room?: Room;

  @Input() game: Game;
  @Input() readonly: boolean;
  @Input() spymaster: boolean;
  @Input() currentClue?: Clue;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
  ) {}

  get isGameOver(): boolean {
    return this.game && (this.game.status === GameStatus.RED_WON ||
      this.game.status === GameStatus.BLUE_WON);
  }

  get isMyTurn(): boolean {
    // Probably a better way for this, feel free to refactor
    if (this.myTeam === TeamTypes.RED) {
      return this.game.status === GameStatus.REDS_TURN;
    }
    return this.game.status === GameStatus.BLUES_TURN;

  }

  get myTeam(): TeamTypes {
    const {currentUserId} = this.authService;
    if (get(this.game, 'redTeam.userIds').includes(currentUserId)) {
      return TeamTypes.RED;
    }
    if (get(this.game, 'blueTeam.userIds').includes(currentUserId)) {
      return TeamTypes.BLUE;
    }
    return TeamTypes.OBSERVER;
  }

  getColor(tile: Tile): string {
    if (!tile.selected) {
      return 'light';
    } else {
      switch (tile.role) {
        case TileRole.ASSASSIN:
          return 'dark';
        case TileRole.CIVILIAN:
          return 'warning';
        case TileRole.BLUE:
          return 'primary';
        case TileRole.RED:
          return 'danger';
      }
    }
  }

  selectTile(tile: Tile) {
    tile.selected = true;
    tile.selectedBy = this.authService.currentUserId;

    const updates: Partial<Game> = {
      tiles: this.game.tiles,
      status: this.getGameStatus(tile),
    };

    // set completedAt when the assassin is clicked
    if (tile.role === TileRole.ASSASSIN) {
      updates.completedAt = Date.now();
    }

    // set the timer if one exists
    if (this.room && this.room.timer && updates.status !== this.game.status) {
      updates.turnEnds = Date.now() + (this.room.timer * 1000);
    }

    this.gameService.updateGame(this.game.id, updates);
  }

  // This recalculates constantly - if I were a better angular developer I would have fixed it already
  // Maybe later :)
  get advice(): string {
    if (this.isGameOver) {
      return '';
    }
    if (this.isMyTurn){
      if (this.spymaster) {
        if (this.currentClue && this.currentClue.team === this.myTeam) {
          return 'Waiting for your team to guess';
        } else {
          return 'Give your team a clue';
        }
      } else {
        // Guesser
        if (this.currentClue && this.currentClue.team === this.myTeam) {
          if (this.currentClue.guessCount === 0 || this.currentClue.guessCount > 10) {
            return 'You have unlimited guesses';
          }
          return `You can guess up to ${this.currentClue.guessCount + 1} words`;
        } else {
          return 'Waiting for spymaster to give a clue';
        }
      }
    }
    return 'Waiting for the other team';
  }

  getGameStatus(tile: Tile) {
    const bluesTurn = this.game.status === GameStatus.BLUES_TURN;
    switch (tile.role) {
      case TileRole.ASSASSIN:
        return bluesTurn ? GameStatus.RED_WON : GameStatus.BLUE_WON;
      case TileRole.CIVILIAN:
        return bluesTurn ? GameStatus.REDS_TURN : GameStatus.BLUES_TURN;
      case TileRole.BLUE:
        return GameStatus.BLUES_TURN;
      case TileRole.RED:
        return GameStatus.REDS_TURN;
      default:
        throw 'What the fuck is this?!';
    }
  }
}
