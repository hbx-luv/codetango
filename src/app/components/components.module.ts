import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';

import {CluesComponent} from './clues/clues.component';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameJoinButtonComponent} from './game-join-button/game-join-button.component';
import {GameComponent} from './game/game.component';
import {PregameComponent} from './pregame/pregame.component';
import {UsersComponent} from './users/users.component';
import {TimerComponent} from './timer/timer.component';
import {TitleBarComponent} from './title-bar/title-bar.component';

@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent,
    CluesComponent,
    UsersComponent,
    GameJoinButtonComponent,
    PregameComponent,
    TimerComponent,
    UsersComponent,
    TitleBarComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
  exports: [
    GameBoardComponent,
    GameComponent,
    CluesComponent,
    UsersComponent,
    GameJoinButtonComponent,
    PregameComponent,
    TimerComponent,
    UsersComponent,
    TitleBarComponent,
  ]
})
export class ComponentsModule {
}
