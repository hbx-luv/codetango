import {Component, Input} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';

import {Game, GameStatus, Tile, TileRole, User} from '../../../../types';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent {
  @Input() game: Game;
  @Input() user: User;
  @Input() readonly: boolean;

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

  selectTile(tile: Tile) {
    tile.selected = true;
    tile.selectedBy = this.authService.currentUserId;
    this.gameService.updateGame(
        this.game.id,
        {tiles: this.game.tiles, status: this.getGameStatus(tile)});
  }

  getGameStatus(tile: Tile) {
    let gameStatus;
    const userOnBlueTeam = this.game.blueTeam.userIds.includes(this.authService.currentUserId);
    if (tile.role === TileRole.ASSASSIN) {
      gameStatus =
          userOnBlueTeam === true ? GameStatus.RED_WON : GameStatus.BLUE_WON;
    } else {
      gameStatus = userOnBlueTeam === true ? GameStatus.REDS_TURN :
                                             GameStatus.BLUES_TURN;
    }
    return gameStatus;
  }

  get chunkedWords(): Array<Tile> {
    return this.chunk(this.game.tiles, 5);
  }

  chunk(arr: Tile[], size: number): Array<Tile> {
    const chunkedArray = [];
    for (let i = 0; i < arr.length; i += size) {
      chunkedArray.push(arr.slice(i, i + size));
    }
    return chunkedArray;
  }
}
