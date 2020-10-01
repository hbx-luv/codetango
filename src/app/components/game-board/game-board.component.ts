import {Component, Input} from '@angular/core';
import {get} from 'lodash';
import {AuthService} from 'src/app/services/auth.service';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';

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

  tiles: Tile[];
  advice: string;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly clueService: ClueService,
  ) {}

  ngOnChanges() {
    this.advice = this.getAdvice();

    // hold onto a copy of the tiles to prevent flickering when the game changes
    if (this.game && this.game.tiles) {
      if (this.tiles) {
        for (let i = 0; i < this.game.tiles.length; i++) {
          Object.assign(this.tiles[i], this.game.tiles[i]);
        }
      } else {
        this.tiles = this.game.tiles;
      }
    }
  }

  get isGameOver(): boolean {
    return this.game && this.game.completedAt > 0;
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
      tiles: this.tiles,
      status: this.getGameStatus(tile),
    };

    // set completedAt when the assassin is clicked
    if (tile.role === TileRole.ASSASSIN) {
      updates.completedAt = Date.now();
    } else if (tile.role === TileRole.BLUE) {
      updates.blueAgents = this.game.blueAgents - 1;
    } else if (tile.role === TileRole.RED) {
      updates.redAgents = this.game.redAgents - 1;
    }

    // set the timer if one exists
    if (this.room && this.room.timer) {
      if (updates.status === this.game.status) {
        // the guess was correct, increment the timer if guessIncrement is set
        if (this.game.turnEnds && this.room.guessIncrement) {
          updates.turnEnds =
              this.game.turnEnds + (this.room.guessIncrement * 1000);
        }
      } else {
        // the turn has switched, new timer
        updates.turnEnds = Date.now() + (this.room.timer * 1000);
      }
    }

    // add this guess to the clue and save
    this.clueService.addGuessToClue(this.game.id, this.currentClue.id, tile);
    this.gameService.updateGame(this.game.id, updates);
  }

  getAdvice(): string {
    if (this.isGameOver) {
      return '';
    }
    if (this.game && !this.game.tiles) {
      return 'Generating board';
    }
    if (this.isMyTurn) {
      if (this.spymaster) {
        if (this.currentClue && this.currentClue.team === this.myTeam) {
          return 'Waiting for your team to guess';
        } else {
          return 'Give your team a clue';
        }
      } else {
        // Guesser
        if (this.currentClue && this.currentClue.team === this.myTeam) {
          if (this.currentClue.guessCount === '0' ||
              this.currentClue.guessCount === '∞') {
            return 'You have unlimited guesses';
          }
          const remaining = this.remainingGuesses(this.currentClue);
          return `You can make ${remaining} more ${
              remaining === 1 ? 'guess' : 'guesses'}`;
        } else {
          return 'Waiting for spymaster to give a clue';
        }
      }
    }
    return 'Waiting for the other team';
  }

  getGameStatus(tile: Tile) {
    const bluesTurn = this.game.status === GameStatus.BLUES_TURN;
    const maxGuessesReached =
        this.currentClue.guessesMade.length + 1 >= this.currentClue.maxGuesses;
    switch (tile.role) {
      case TileRole.ASSASSIN:
        return bluesTurn ? GameStatus.RED_WON : GameStatus.BLUE_WON;
      case TileRole.CIVILIAN:
        return bluesTurn ? GameStatus.REDS_TURN : GameStatus.BLUES_TURN;
      case TileRole.BLUE:
        return maxGuessesReached && bluesTurn ? GameStatus.REDS_TURN :
                                                GameStatus.BLUES_TURN;
      case TileRole.RED:
        return maxGuessesReached && !bluesTurn ? GameStatus.BLUES_TURN :
                                                 GameStatus.REDS_TURN;
      default:
        throw new Error('What the fuck is this?!');
    }
  }

  remainingGuesses(clue: Clue): number {
    return clue ? clue.maxGuesses - clue.guessesMade.length : 0;
  }
}
