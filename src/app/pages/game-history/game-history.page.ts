import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from 'src/app/services/game.service';
import {Game} from 'types';

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
      private readonly router: Router,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.games$ = this.gameService.getCompletedGames(this.roomId);
  }

  gameClicked(game: Game) {
    this.router.navigate([this.roomId, 'games', game.id]);
  }
}
