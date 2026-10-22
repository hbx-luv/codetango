import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from 'src/app/services/auth.service';
import {PresenceService} from 'src/app/services/presence.service';
import {UserService} from 'src/app/services/user.service';
import {UserRole} from 'types';

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
      private readonly userService: UserService,
      // injected so the lastActive heartbeat starts with the app
      _presenceService: PresenceService,
  ) {}

  get isLoggedIn() {
    return this.authService.authenticated;
  }

  // The admin page guards itself on the same role; this just surfaces the
  // link for people who can actually use it.
  get isAdmin(): boolean {
    return this.userService.currentUser?.role === UserRole.ADMIN;
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
