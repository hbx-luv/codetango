import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {Router} from '@angular/router';
import {PopoverController} from '@ionic/angular';
import {Observable} from 'rxjs';
import {AuthService} from 'src/app/services/auth.service';

import {User} from '../../../../types';
import {UserService} from '../../services/user.service';

enum PopoverAction {
  REMOVE = 'REMOVE',
  SPYMASTER = 'SPYMASTER',
  SCORECARD = 'SCORECARD',
}

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss'],
})
export class UsersComponent implements OnChanges {
  BASE_WIDTH = 75;

  @Input() userId: string;
  @Input() color: string;
  @Input() showUserName = true;
  @Input() navToScorecard = true;
  @Input() showActions = false;

  @Output() remove = new EventEmitter<void>();
  @Output() setSpymaster = new EventEmitter<void>();

  user$: Observable<User>;
  style: {width: string};
  popoverOpen = false;

  constructor(
      readonly authService: AuthService,
      private readonly userService: UserService,
      private readonly router: Router,
      private readonly popoverController: PopoverController,
  ) {
    this.style = {width: `${this.getRandomWidth()}px`};
  }

  ngOnChanges() {
    if (this.userId) {
      this.user$ = this.userService.getUser(this.userId);
    }
  }

  getRandomWidth() {
    return this.BASE_WIDTH + Math.floor(Math.random() * 20) + 1;
  }

  goToUser($event) {
    if (this.navToScorecard) {
      $event.stopPropagation();
      this.router.navigate(['scorecard', this.userId]);
    }
  }

  async showOptions($event: Event) {
    // prevent the original click handler and spawn a popover with some options
    $event.stopPropagation();
    const popover = await this.popoverController.create({
      component: UserOptionsComponent,
      event: $event,
      translucent: true,
    });
    this.popoverOpen = true;
    await popover.present();

    // when the popover is dismissed, handle any action clicked
    popover.onDidDismiss().then(detail => {
      this.handleAction(detail.data);
      this.popoverOpen = false;
    });
  }

  handleAction(action?: PopoverAction) {
    switch (action) {
      case PopoverAction.REMOVE:
        return this.remove.emit();
      case PopoverAction.SPYMASTER:
        return this.setSpymaster.emit();
      case PopoverAction.SCORECARD:
        return this.router.navigate(['scorecard', this.userId]);
      default:
        return;
    }
  }

  get getColor(): string {
    if (this.color && this.color.toLowerCase() === 'red') {
      return 'danger';
    }
    if (this.color && this.color.toLowerCase() === 'blue') {
      return 'primary';
    }
    return 'dark';
  }

  get shouldOutline(): boolean {
    if (this.getColor === 'dark' || this.you) {
      return false;
    }
    return true;
  }

  get you(): boolean {
    return this.authService.currentUserId === this.userId;
  }
}

@Component({
  template: `
    <ion-list>
      <ion-item button (click)="popoverController.dismiss(PopoverAction.REMOVE)">Remove From Team</ion-item>
      <ion-item button (click)="popoverController.dismiss(PopoverAction.SPYMASTER)">Set As Spymaster</ion-item>
      <ion-item button (click)="popoverController.dismiss(PopoverAction.SCORECARD)">See Scorecard</ion-item>
    </ion-list>
  `
})
class UserOptionsComponent {
  PopoverAction = PopoverAction;
  constructor(readonly popoverController: PopoverController) {}
}