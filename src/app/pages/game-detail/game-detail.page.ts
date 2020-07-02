import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {GameService} from 'src/app/services/game.service';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-game-detail',
  templateUrl: './game-detail.page.html',
  styleUrls: ['./game-detail.page.scss'],
})
export class GameDetailPage {
  roomId: string;
  gameId: string;

  constructor(
      private readonly gameService: GameService,
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly utilService: UtilService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.gameId = this.route.snapshot.paramMap.get('gameId');
  }

  async deleteGame() {
    const doIt = await this.utilService.confirm(
        'Delete this game?',
        'Delete',
        'Nevermind',
    );
    if (doIt) {
      const loader = await this.utilService.presentLoader('Deleting game...');
      await this.gameService.deleteGame(this.gameId);
      this.router.navigate([this.roomId, 'games']);
      await loader.dismiss();
    }
  }
}
