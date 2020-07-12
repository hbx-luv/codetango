import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from 'src/app/services/game.service';
import {Game} from 'types';

const LIMIT = 10;

@Component({
  selector: 'app-game-history',
  templateUrl: './game-history.page.html',
  styleUrls: ['./game-history.page.scss'],
})
export class GameHistoryPage {
  roomId: string;
  games$: Observable<Game[]>;

  constructor(
      private readonly gameService: GameService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.games$ = this.gameService.getCompletedGames(this.roomId, LIMIT);
  }
}
