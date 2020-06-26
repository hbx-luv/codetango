import {Component} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';

@Component({
  selector: 'app-game-join-button',
  templateUrl: './game-join-button.component.html',
  styleUrls: ['./game-join-button.component.scss'],
})
export class GameJoinButtonComponent {
  constructor(
      private readonly authService: AuthService,
  ) {}

  get showLogin(): boolean {
    return !this.authService.authenticated;
  }

  get
}
