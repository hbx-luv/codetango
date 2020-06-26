import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from '@ionic/angular';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameComponent} from './game/game.component';
import {CluesComponent} from './clues/clues.component';
import {FormsModule} from '@angular/forms';
import {PregameComponent} from './pregame/pregame.component';
import {UsersComponent} from './users/users.component';

@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent,
    CluesComponent,
    PregameComponent,
    UsersComponent
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
    PregameComponent,
    UsersComponent
  ]
})
export class ComponentsModule {
}
