import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Platform} from '@ionic/angular';
import {Observable} from 'rxjs';
import {Game} from 'types';

import {GameService} from './services/game.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  games$: Observable<Game[]>;

  constructor(
      private readonly platform: Platform,
      private readonly splashScreen: SplashScreen,
      private readonly statusBar: StatusBar,
      private readonly router: Router,
      private readonly gameService: GameService,
  ) {
    this.initializeApp();

    // update the games observable on route changes
    // just grab one game to see if this room has any completed games
    // hide the history tab if there are no games
    router.events.subscribe(event => {
      this.games$ = this.gameService.getCompletedGames(this.roomId, 1);
    });
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }

  get roomId(): string {
    // for whatever reason, the ActivatedRoute snapshot returned null when
    // getting the id from the paramMap. This is a reliable way to strip out the
    // roomId from the URL
    return this.router.url.split('/')[1].split('/')[0];
  }
}
