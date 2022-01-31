import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {first} from 'rxjs/operators';
import {GameService} from 'src/app/services/game.service';
import {Game} from 'types';

const PATTERN = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const LIMIT = 10;

@Component({
  selector: 'app-game-history',
  templateUrl: './game-history.page.html',
  styleUrls: ['./game-history.page.scss'],
})
export class GameHistoryPage {
  games: Game[];
  roomId: string;
  infiniteScrollDisabled = true;
  
  showDeleted = false;
  current = 0;
  bound;

  constructor(
      private readonly gameService: GameService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.reset();
  }

  ionViewDidEnter() {
    this.bound =  this.keyHandler.bind(this);
    document.addEventListener('keydown', this.bound);
  }
  
  ionViewDidLeave() {
    document.removeEventListener('keydown', this.bound);
  }

  async reset() {
    // reset and reload
    this.infiniteScrollDisabled = true;
    delete this.games;
    await this.loadMore();
  }

  /**
   * Load more games starting from the game game we know about
   * @param event An Ionic CustomEvent for infinite scroll
   */
  async loadMore(event?) {
    // determine startAfter from the last game in thge collection
    let startAfter;
    if (this.games && this.games.length) {
      startAfter = this.games[this.games.length - 1].completedAt;
    }

    // fetch LIMIT more games
    const collection = this.showDeleted ? 'deletedGames' : 'games';
    const moreGames =
        await this.gameService.getCompletedGames(this.roomId, LIMIT, startAfter, collection)
            .pipe(first())
            .toPromise();

    // instantiate the games array if undefined
    if (this.games === undefined) {
      this.games = [];
    }

    // push all new games into this array
    for (const game of moreGames) {
      this.games.push(game);
    }

    // tell infinite scroll to complete
    if (event) {
      event.target.complete();
    }

    if (moreGames.length === 0) {
      // when there are no more games loaded, disable infinite scroll
      this.infiniteScrollDisabled = true;
    } else if (moreGames.length < LIMIT) {
      // when few were loaded, load more immediately to prevent a weird case
      // where not all games emit on the observable on the first request
      this.loadMore();
    } else {
      // otherwise, re-enable infinite scroll
      this.infiniteScrollDisabled = false;
    }
  }

  private keyHandler (event) {
    // If the key isn't the current key in the pattern, reset
    if (event.key !== PATTERN[this.current]) {
      console.log(`${event.key} !== ${PATTERN[this.current]}`)
      this.current = 0;
      return;
    }

    // Update how much of the pattern is complete
    this.current++;

    // If complete, reset
    if (PATTERN.length === this.current) {
      this.current = 0;
      this.showDeleted = !this.showDeleted;
      this.reset();
    }
  }
}
