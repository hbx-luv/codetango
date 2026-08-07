import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';
import {ClueService} from 'src/app/services/clue.service';
import {GameService} from 'src/app/services/game.service';
import {Clue, Game, GameStatus, GameType, Room, TeamType, Tile, TileRole} from '../../../../types';
import {Sound, SoundService} from '../../services/sound.service';
import { getSrc } from '../game/tile-util';

// pop out + hold + settle + flip; keep in sync with the tile-reveal
// keyframes in the component scss
const REVEAL_ANIMATION_MS = 1300;

// how long a tap holds a revealed tile flipped back over on touch devices
const PEEK_MS = 3000;

// how many numbered character images exist per role in assets/characters
// (char-red-team-N.png etc.) — bump when new art is added. A pool at least
// as large as the tile count for that role means no duplicates on a board.
const CHARACTER_POOLS: {[role: string]: number} = {
  [TileRole.RED]: 9,
  [TileRole.BLUE]: 9,
  [TileRole.CIVILIAN]: 7,
};

@Component({
  standalone: false,
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent implements OnChanges {
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
  advice: string;
  shaking = false;

  // tiles that were just revealed, keyed by word/image, for the flip animation
  private recentlyRevealed = new Set<string>();
  // selections we've already seen, so remote updates only animate new ones;
  // undefined until the first snapshot so loading a game stays silent
  private seenSelected: Set<string>;
  private lastStatus: GameStatus;
  private lastCompleted = false;

  // per-game character assignment; rebuilt when the game id changes
  private characterVariants?: {gameId: string, byKey: Map<string, number>};

  // revealed tiles the user is peeking under (hover on desktop, tap on touch)
  private peeking = new Set<string>();
  private peekTimers = new Map<string, number>();
  private readonly canHover =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(hover: hover)').matches;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly clueService: ClueService,
      private readonly soundService: SoundService,
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
      this.trackReveals();
    }
  }

  /**
   * Detect tiles revealed by other players so everyone gets the flip
   * animation and guess sound (local clicks register in selectTile)
   */
  private trackReveals() {
    const selected = this.tiles.filter(t => t.selected);
    if (this.seenSelected) {
      for (const tile of selected) {
        const key = this.tileKey(tile);
        if (!this.seenSelected.has(key)) {
          this.seenSelected.add(key);
          // lastCompleted (not the current value) so the game-ending
          // reveal still animates, but completed-game views stay silent
          if (!this.lastCompleted) {
            this.revealTile(tile, this.lastStatus);
          }
        }
      }
    } else {
      this.seenSelected = new Set(selected.map(t => this.tileKey(t)));
    }
    this.lastStatus = this.game.status;
    this.lastCompleted = !!this.game.completedAt;
  }

  private tileKey(tile: Tile): string {
    return tile.word ?? tile.image ?? '';
  }

  /**
   * Animate a newly revealed tile and play a sound for the guess outcome.
   * turnStatus is the game status when the guess was made, which tells us
   * whose guess it was
   */
  private revealTile(tile: Tile, turnStatus: GameStatus) {
    const key = this.tileKey(tile);
    this.recentlyRevealed.add(key);
    setTimeout(
        () => this.recentlyRevealed.delete(key), REVEAL_ANIMATION_MS);

    if (tile.role === TileRole.ASSASSIN) {
      this.shaking = true;
      setTimeout(() => this.shaking = false, REVEAL_ANIMATION_MS);
      this.soundService.play(Sound.ASSASSIN);
    } else if (tile.role === TileRole.CIVILIAN) {
      this.soundService.play(Sound.WRONG_GUESS);
    } else {
      const guessingTeam = turnStatus === GameStatus.REDS_TURN ?
          TileRole.RED :
          TileRole.BLUE;
      this.soundService.play(
          tile.role === guessingTeam ? Sound.CORRECT_GUESS :
                                       Sound.WRONG_GUESS);
    }
  }

  isRevealing(tile: Tile): boolean {
    return this.recentlyRevealed.has(this.tileKey(tile));
  }

  isFlipped(tile: Tile): boolean {
    return !!tile.selected && !this.peeking.has(this.tileKey(tile));
  }

  startPeek(tile: Tile) {
    if (!this.canHover || !tile.selected || this.isRevealing(tile)) {
      return;
    }
    this.peeking.add(this.tileKey(tile));
  }

  endPeek(tile: Tile) {
    if (this.canHover) {
      this.peeking.delete(this.tileKey(tile));
    }
  }

  // isRevealing guards the tap that just flipped the tile — its click also
  // bubbles here, and shouldn't immediately peek back under the new card
  tapPeek(tile: Tile) {
    if (this.canHover || !tile.selected || this.isRevealing(tile)) {
      return;
    }
    const key = this.tileKey(tile);
    this.peeking.add(key);
    clearTimeout(this.peekTimers.get(key));
    this.peekTimers.set(key, window.setTimeout(() => {
      this.peeking.delete(key);
      this.peekTimers.delete(key);
    }, PEEK_MS));
  }

  getCharacterSrc(tile: Tile): string {
    switch (tile.role) {
      case TileRole.ASSASSIN:
        return 'assets/characters/char-assasin.png';
      case TileRole.RED:
        return `assets/characters/char-red-team-${this.variant(tile)}.png`;
      case TileRole.BLUE:
        return `assets/characters/char-blue-team-${this.variant(tile)}.png`;
      default:
        return `assets/characters/char-neutral-${this.variant(tile)}.png`;
    }
  }

  /**
   * Deterministic character image number for a tile: each role's pool is
   * shuffled once per game (seeded by game id) and dealt out in board order,
   * so no image repeats until the pool is exhausted, and every client and
   * rerender agrees on the assignment
   */
  private variant(tile: Tile): number {
    if (this.characterVariants?.gameId !== this.game.id) {
      this.characterVariants = {
        gameId: this.game.id,
        byKey: this.dealCharacters(),
      };
    }
    return this.characterVariants.byKey.get(this.tileKey(tile)) ?? 1;
  }

  private dealCharacters(): Map<string, number> {
    const byKey = new Map<string, number>();
    const decks = new Map<string, number[]>();
    let seed = this.hash(this.game.id ?? '');

    // mulberry32 — a tiny seeded PRNG so the shuffle is stable per game
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (const tile of this.game.tiles ?? []) {
      const poolSize = CHARACTER_POOLS[tile.role];
      if (!poolSize) {
        continue;  // assassin has a single dedicated image
      }
      let deck = decks.get(tile.role);
      if (!deck?.length) {
        deck = Array.from({length: poolSize}, (_, i) => i + 1);
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        decks.set(tile.role, deck);
      }
      byKey.set(this.tileKey(tile), deck.pop());
    }
    return byKey;
  }

  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return hash;
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
    if (this.game?.redTeam?.userIds?.includes(currentUserId)) {
      return TeamType.RED;
    }
    if (this.game?.blueTeam?.userIds?.includes(currentUserId)) {
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

    // animate and play the sound immediately for the clicker; marking the
    // tile as seen keeps the Firestore echo from replaying it
    this.seenSelected?.add(this.tileKey(tile));
    this.revealTile(tile, this.game.status);

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
