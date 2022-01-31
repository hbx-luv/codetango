import {Component, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ReplaySubject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {UtilService} from 'src/app/services/util.service';
import {Game} from 'types';
import {default as firebase} from 'firebase';

@Component({
  selector: 'app-game-detail',
  templateUrl: './game-detail.page.html',
  styleUrls: ['./game-detail.page.scss'],
})
export class GameDetailPage implements OnDestroy {
  private destroyed = new ReplaySubject<never>();

  roomId: string;
  gameId: string;
  game: Game;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly route: ActivatedRoute,
      private readonly router: Router,
      private readonly utilService: UtilService,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.gameId = this.route.snapshot.paramMap.get('gameId');
    this.gameService.getGame(this.gameId)
        .pipe(takeUntil(this.destroyed))
        .subscribe(game => {
          this.game = game;
        });
  }

  get canDelete(): boolean {
    return this.game?.exists && this.authService.authenticated &&
        (this.game.blueTeam.userIds.includes(this.authService.currentUserId) ||
         this.game.redTeam.userIds.includes(this.authService.currentUserId));
  }

  async deleteGame() {
    const doIt = await this.utilService.confirm(
        'Delete this game?',
        'This action cannot be undone.',
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

  async restoreGame() {
    const db = firebase.firestore();
    const snap = await db.collection('deletedGames').where('id', '==', this.game.id).get();
    if (snap.docs.length > 0) {
      const data = snap.docs[0].data();
      delete data.id;
      const ref = await db.collection('games').add(data);
      snap.docs[0].ref.delete();
      this.router.navigate([`../${ref.id}`], {
        relativeTo: this.route,
        replaceUrl: true,
      });
    } else {
      this.utilService.showToast(`No deleted games with id: ${this.game.id}`);
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
  }
}
