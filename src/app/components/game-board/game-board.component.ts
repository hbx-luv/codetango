import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent implements OnInit {

  chunkedWords = []

  constructor() { }

  ngOnInit() {}

  getWordList() {
    const test = 'A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y'
    const testArr = test.split(',');
    this.chunkedWords = this.chunk(testArr, 5);
    // TODO - Actually get live words
    // 1. Get 25 words and check if not in previous game
    // 2. Use chunk() method below to chunk into groups of 5 and set it to var with chunkedWords = chunk(arrayOf25, 5)
  }

  chunk(arr, size) {
    const chunkedArray = [];
    for (let i = 0; i < arr.length; i += size) {
      chunkedArray.push(arr.slice(i, i + size));
    }
    return chunkedArray;
  }

}
