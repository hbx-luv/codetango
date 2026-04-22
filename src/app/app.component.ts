import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from 'src/app/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
      private readonly router: Router,
      private readonly authService: AuthService,
  ) {}

  get isLoggedIn() {
    return this.authService.authenticated;
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
