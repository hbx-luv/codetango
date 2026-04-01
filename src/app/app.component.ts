import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Platform} from '@ionic/angular';
import {AuthService} from 'src/app/services/auth.service';
import {AprilFoolsService} from 'src/app/services/april-fools.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
      private readonly platform: Platform,
      private readonly splashScreen: SplashScreen,
      private readonly statusBar: StatusBar,
      private readonly router: Router,
      private readonly authService: AuthService,
      readonly aprilFoolsService: AprilFoolsService,
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }

  get isLoggedIn() {
    return this.authService.authenticated;
  }

  /** Matt only: controls global April Fools mode in Firestore for all players. */
  get showAprilFoolsAdminToggle(): boolean {
    return this.isLoggedIn &&
        this.aprilFoolsService.isAdminUser(this.authService.currentUser?.email);
  }

  logout() {
    this.authService.logout();
  }

  login() {
    this.authService.loginWithGoogle();
  }

  get roomId(): string {
    // for whatever reason, the ActivatedRoute snapshot returned null when
    // getting the id from the paramMap. This is a reliable way to strip out the
    // roomId from the URL
    return this.router.url.split('/')[1].split('/')[0];
  }
}
