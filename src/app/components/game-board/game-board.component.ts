import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output} from '@angular/core';
import {get} from 'lodash';
import {Subscription} from 'rxjs';
import {AprilFoolsService} from 'src/app/services/april-fools.service';
import {AuthService} from 'src/app/services/auth.service';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';
import {Clue, Game, GameStatus, GameType, Room, TeamType, Tile, TileRole} from '../../../../types';
import { getSrc } from '../game/tile-util';

/** Exactly one visual mutation per tile when April Fools is on. */
export type AprilFoolsTileMutation =
    'none'|'flipV'|'flipH'|'blink'|'tl'|'tr'|'bl'|'br'|'rotate';

export interface AprilFoolsDisplaySlot {
  tile: Tile;
  mutation: AprilFoolsTileMutation;
  /** Degrees; only set when mutation === 'rotate'. */
  rotateDeg?: number;
}

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent implements OnChanges, OnInit, OnDestroy {
  // readonly versions of the game board won't user the room
  @Input() room?: Room;

  @Input() game: Game;
  @Input() readonly: boolean;
  @Input() spymaster: boolean;
  @Input() currentClue?: Clue;
  @Input() throwingDart: boolean;

  @Output() clicked = new EventEmitter<void>();

  GameType = GameType;

  tiles: Tile[];
  displaySlots: AprilFoolsDisplaySlot[] = [];
  advice: string;

  private aprilFoolsSub?: Subscription;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly clueService: ClueService,
      private readonly aprilFoolsService: AprilFoolsService,
      private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.aprilFoolsSub = this.aprilFoolsService.enabled$.subscribe(() => {
      this.rebuildDisplaySlots();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.aprilFoolsSub?.unsubscribe();
  }

  get aprilFoolsBoard(): boolean {
    return this.aprilFoolsService.enabled;
  }

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
    this.rebuildDisplaySlots();
  }

  private rebuildDisplaySlots() {
    if (!this.tiles?.length) {
      this.displaySlots = [];
      return;
    }
    if (!this.aprilFoolsService.enabled) {
      this.displaySlots = this.tiles.map(tile => ({
        tile,
        mutation: 'none' as AprilFoolsTileMutation,
      }));
      return;
    }
    const seed =
        `${this.game?.id ?? 'game'}|${this.authService.currentUserId || 'anon'}`;
    const rng = mulberry32(hashString(seed));
    const pairs = this.tiles.map(tile => ({tile}));
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = t;
    }
    this.displaySlots = pairs.map(({tile}) => {
      const mutation = pickAprilFoolsMutation(rng);
      const rotateDeg =
          mutation === 'rotate' ? rng() * 360 : undefined;
      return {tile, mutation, rotateDeg};
    });
  }

  aprilFoolsRotateTransform(slot: AprilFoolsDisplaySlot): string|null {
    if (slot.mutation !== 'rotate' || slot.rotateDeg == null) {
      return null;
    }
    return `rotate(${slot.rotateDeg}deg)`;
  }

  get type(): GameType {
    if (this.game) {
      if (this.game?.gameType) {
        return this.game.gameType;
      } else if (this.game.hasPictures) {
        return GameType.PICTURES;
      } else if (this.game.hasEmojis) {
        // hardcoded legacy timestamp of the last game to play with the initial
        // (legacy) version of codenames emojis
        if (this.game.createdAt < 1604606378903) {
          return GameType.LEGACY_EMOJIS;
        } else {
          return GameType.EMOJIS;
        }
      } else {
        return GameType.WORDS;
      }
    }

    return null;
  }

  get isGameOver(): boolean {
    return this.game && this.game.completedAt > 0;
  }

  get isMyTurn(): boolean {
    // Probably a better way for this, feel free to refactor
    if (this.myTeam === TeamType.RED) {
      return this.game.status === GameStatus.REDS_TURN;
    }
    return this.game.status === GameStatus.BLUES_TURN;
  }

  get myTeam(): TeamType {
    const {currentUserId} = this.authService;
    if (get(this.game, 'redTeam.userIds').includes(currentUserId)) {
      return TeamType.RED;
    }
    if (get(this.game, 'blueTeam.userIds').includes(currentUserId)) {
      return TeamType.BLUE;
    }
    return TeamType.OBSERVER;
  }

  get isObserver(): boolean {
    return this.myTeam === TeamType.OBSERVER;
  }

  getPictureSrc(word: string) {
    const pattern = this.game.assetUrlPattern;
    return getSrc(pattern, word);
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
    if (this.readonly) {
      return;  // Prevents any type of click trigger (ie, tab and enter)
    }
    tile.selected = true;
    tile.selectedBy = this.authService.currentUserId;

    if (this.throwingDart) {
      tile.dartedBy = `${this.myTeam}` as TileRole;
    }

    const updates: Partial<Game> = {tiles: this.tiles};

    // decrement the agents remaining if a red or blue tile was discovered
    if (tile.role === TileRole.BLUE) {
      updates.blueAgents = this.game.blueAgents - 1;
    } else if (tile.role === TileRole.RED) {
      updates.redAgents = this.game.redAgents - 1;
    }

    // get the game status and determine if the game is over
    updates.status = this.getGameStatus(tile, updates);
    if ([GameStatus.BLUE_WON, GameStatus.RED_WON].includes(updates.status)) {
      updates.completedAt = Date.now();
    }

    // set the timer if one exists
    if (this.room && this.room.timer && !updates.completedAt) {
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
    this.clicked.emit();
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

  getGameStatus(tile: Tile, updates: Partial<Game>) {
    // check for the win condition of all agents contacted
    if (updates.blueAgents === 0) {
      return GameStatus.BLUE_WON;
    } else if (updates.redAgents === 0) {
      return GameStatus.RED_WON;
    }

    // otherwise do it by tile clicked logic
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

  /**
   * Returns true if the given word is a color name (case insensitive)
   */
  private isColorClue(word: string): boolean {
    if (!word) return false;
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey'];
    return colors.includes(word.toLowerCase());
  }

  /**
   * Returns true if the current clue is a color clue and it's the current team's turn
   */
  get shouldGreyscale(): boolean {
    if (!this.currentClue) return false;
    
    // Only apply greyscale if it's the current team's turn
    const isCurrentTeamsTurn = 
      (this.currentClue.team === TeamType.BLUE && this.game.status === GameStatus.BLUES_TURN) ||
      (this.currentClue.team === TeamType.RED && this.game.status === GameStatus.REDS_TURN);
    
    return isCurrentTeamsTurn && this.isColorClue(this.currentClue.word);
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const APRIL_FOOLS_MUTATIONS: AprilFoolsTileMutation[] = [
  'none',
  'flipV',
  'flipH',
  'blink',
  'tl',
  'tr',
  'bl',
  'br',
  'rotate',
];

function pickAprilFoolsMutation(rng: () => number): AprilFoolsTileMutation {
  const i = Math.floor(rng() * APRIL_FOOLS_MUTATIONS.length);
  return APRIL_FOOLS_MUTATIONS[i];
}
