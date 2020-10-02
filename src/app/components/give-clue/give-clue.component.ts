import {Component, Input, OnDestroy} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import {tap} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {UtilService} from 'src/app/services/util.service';

import {Game, GameStatus, ProposedClue, TeamTypes, Tile} from '../../../../types';
import {Sound, SoundService} from '../../services/sound.service';

const TOAST_DURATION = 10000;
const TOAST_OPTIONS = {
  buttons: ['got it']
};

// the list of small words to ignore for screening clues
const SMALL_WORDS = ['A', 'AN', 'AND', 'TO', 'THE'];

@Component({
  selector: 'app-give-clue',
  templateUrl: './give-clue.component.html',
  styleUrls: ['./give-clue.component.scss'],
})
export class GiveClueComponent implements OnDestroy {
  private destroyed = new ReplaySubject<never>();

  @Input() game: Game;
  @Input() isMyTurn: boolean;
  @Input() currentClueIsFromMyTeam: boolean;

  proposedClue$: Observable<ProposedClue|null>;
  latestClue: ProposedClue;
  alertTimerId;

  clue: string;
  clueCount: number;

  constructor(
      public readonly clueService: ClueService,
      private readonly utilService: UtilService,
      private readonly soundService: SoundService,
  ) {}

  ngOnInit() {
    this.proposedClue$ =
        this.clueService.getProposedClue(this.game.id)
            .pipe(tap(proposedClue => {
              this.latestClue = proposedClue;

              // while the proposed clue is still needing spymaster attention,
              // play the alert every 3 seconds until they respond to it
              if (proposedClue && !this.isMyTurn) {
                this.alertTimerId = setInterval(() => {
                  if (this.latestClue && !this.isMyTurn) {
                    this.soundService.play(Sound.PROPOSED_CLUE);
                  } else {
                    clearInterval(this.alertTimerId);
                  }
                }, 3000);
                this.soundService.play(Sound.PROPOSED_CLUE);
              }
            }));
  }

  /**
   * Submit the clue as a spymaster. If askFirst is true, double check with the
   * opposing spymaster so they can approve the clue before it is shown to your
   * operatives
   * @param askFirst
   */
  async submitClue(askFirst = false) {
    // Need to check if the clue is valid before submitting
    if (this.disableSubmitButton) {
      this.sendWittyToast();
    } else {
      const word = this.clue.toUpperCase().trim();

      // for non-picture games, in cases where they didn't ask first check for
      // clue overlaps with tiles on the board, and make the other spymaster
      // confirm it if there is an overlap
      if (!askFirst && !this.game.hasPictures) {
        const overlap = this.getOverlap(this.game.tiles, word);
        if (overlap.length === 2) {
          askFirst = await this.utilService.confirm(
              'Questionable Clue',
              `Your clue is questionable because ${overlap[0]} overlaps with ${
                  overlap[1]}. Ask the other spymaster first?`,
              'Ask First', 'Edit Clue');

          // don't submit clue if they select "Edit Clue"
          if (!askFirst) return;
        }
      }

      // clues that are more than one word should be approved by the other
      // spymaster before proceeding
      if (!askFirst && word.split(' ').length > 1) {
        askFirst = true;
        this.utilService.showToast(
            'Clues should typically be only one word, but can sometimes be more than one word in the case of proper nouns. We sent the clue to be approved by the other spymaster.',
            TOAST_DURATION, TOAST_OPTIONS)
      }

      const clue = {
        word,
        guessCount: this.getGuessCount(this.clueCount),
        maxGuesses: this.clueCount === 0 ? 999 : this.clueCount + 1,
        guessesMade: [],
        createdAt: Date.now(),
        team: GameStatus.BLUES_TURN === this.game.status ? TeamTypes.BLUE :
                                                           TeamTypes.RED,
      };

      if (askFirst) {
        this.clueService.proposeClue(this.game.id, clue);
      } else {
        this.clueService.addClue(this.game.id, clue);
      }

      this.clue = null;
      this.clueCount = null;
    }
  }

  get disableSubmitButton(): boolean {
    // this.clueCount >= 0 didn't work when I put a number and then deleted the
    // number
    const hasAClue = (this.clueCount === 0 || this.clueCount > 0) &&
        !!this.clue && this.clue.trim().length;
    return !hasAClue || !this.isMyTurn || this.currentClueIsFromMyTeam;
  }

  getGuessCount(clueCount: number): string {
    if (clueCount < 0) {
      return '0';
    } else if (clueCount > 9) {
      return '∞';
    } else {
      return clueCount.toFixed(0);
    }
  }

  sendWittyToast() {
    // fallback
    let message =
        'Something went wrong. Double check that your clue is valid and that it\'s your turn.';

    // handle validation
    if (!this.isMyTurn) {
      message =
          'It\'s not your turn! I know the other team is taking forreeveeerrrr, but they\'ll mess up soon, I promise.';
    } else if (this.currentClueIsFromMyTeam) {
      message =
          'You already gave your team a clue! Now just sit back, relax, and scream at your computer screen while they discuss clicking on the assassin.';
    } else if (!this.clue || !this.clue.trim().length) {
      message =
          'You are very return-key-happy. Try again after you have typed a clue.';
    } else if (!this.clueCount && this.clueCount !== 0) {
      message =
          'Nice clue! Now give your team some idea of how many tiles you want them to click on!';
    }

    return this.utilService.showToast(message, TOAST_DURATION, TOAST_OPTIONS);
  }

  /**
   * If any of the words for the tiles on the board overlap with the any of the
   * words within the clue return the overlapping parts
   * @param tiles
   * @param clue
   */
  getOverlap(tiles: Tile[], clue: string): string[] {
    for (const tile of tiles) {
      for (const subword of tile.word.split(' ')) {
        for (const subclue of clue.split(' ')) {
          // only check subparts of the clue that are 3 characters or more
          // for example "WELCOME TO THE JUNGLE" should not match "PISTOL" just
          // because "PISTOL" includes "TO" (that clue is still debatable)
          // ignore the hardcoded list of small words too
          if (subclue.length > 2 && !SMALL_WORDS.includes(subclue) &&
              this.lowerCaseIncludes(subword, subclue)) {
            return [subclue, tile.word];
          }
        }
      }
    }

    return [];
  }

  /**
   * Return true if either a includes b or b includes a, case agnostic
   * @param a
   * @param b
   */
  lowerCaseIncludes(a: string, b: string): boolean {
    a = a.toLowerCase();
    b = b.toLowerCase();
    console.log(`comparing ${a} and ${b}`);
    return a.includes(b) || b.includes(a);
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
