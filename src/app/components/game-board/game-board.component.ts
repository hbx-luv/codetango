import {Component, Input} from '@angular/core';
import {GameService} from 'src/app/services/game.service';

import {Game, Tile, TileRole} from '../../../../types';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent {
  @Input() game: Game;

  constructor(
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

  selectTile(tile: Tile, username: string) {
    tile.selected = true;
    // tile.selectedBy = username;
    // TODO: use the real ID dammit
    this.gameService.updateGame('testGame', {tiles: this.game.tiles});
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
