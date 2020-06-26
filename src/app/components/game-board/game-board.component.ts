import {Component, OnInit} from '@angular/core';
import {Tile, TileRole} from '../../../../types';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent implements OnInit {

  chunkedWords = [];

  constructor() { }

  ngOnInit() {
    this.mockTile();
  }

  getColor(tile: Tile): string {
    if (!tile.selected) {
      return 'medium';
    } else {
      switch (tile.role) {
        case TileRole.ASSASSIN:
          return 'dark';
        case TileRole.CIVILIAN:
          return 'light';
        case TileRole.BLUE:
          return 'default';
        case TileRole.RED:
          return 'danger';
      }
    }
  }

  selectTile(tile: Tile, username: string) {
    tile.selected = true;
    tile.selectedBy = username;
  }
  mockTile() {
    const tileArr = []
    for (let i = 0; i < 25; i++) {
      tileArr.push(
      {
        word: 'A',
        role:  i < 12 ? TileRole.CIVILIAN : TileRole.ASSASSIN,
        selected: false,
        selectedBy: 'ryry'
      });
    }
    this.chunkedWords = this.chunk(tileArr, 5);
  }

  chunk(arr: Tile[], size: number): Array<Tile> {
    const chunkedArray = [];
    for (let i = 0; i < arr.length; i += size) {
      chunkedArray.push(arr.slice(i, i + size));
    }
    return chunkedArray;
  }

}
