import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';

import {Game, GameStatus, Tile, TileRole} from '../../../../types';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent {
  @Input() game: Game;
  @Input() readonly: boolean;
  @Input() spymaster: boolean;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
  ) {}

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

  selectTile(tile: Tile, index: number) {
    console.log(index);
    tile.selected = true;
    tile.selectedBy = this.authService.currentUserId;

    // update the game titles and status
    const updates: any = {
      tiles: this.game.tiles,
      status: this.getGameStatus(tile),
    };

    // determine game over
    if (this.isGameOver(tile, this.game)) {
      updates.completedAt = Date.now();
    }

    this.gameService.updateGame(this.game.id, updates);
  }

  getGameStatus(tile: Tile) {
    const userOnBlueTeam =
        this.game.blueTeam.userIds.includes(this.authService.currentUserId);

    switch (tile.role) {
      case TileRole.ASSASSIN:
        return userOnBlueTeam ? GameStatus.RED_WON : GameStatus.BLUE_WON;
      case TileRole.CIVILIAN:
        return userOnBlueTeam ? GameStatus.REDS_TURN : GameStatus.BLUES_TURN;
      case TileRole.BLUE:
        return GameStatus.BLUES_TURN;
      case TileRole.RED:
        return GameStatus.REDS_TURN;
      default:
        throw 'What the fuck is this?!';
    }
  }

  isGameOver(tile: Tile, game: Game) {
    return tile.role === TileRole.ASSASSIN;
  }
}
