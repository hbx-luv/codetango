import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from '@ionic/angular';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameComponent} from './game/game.component';
import {CluesComponent} from './clues/clues.component';
import {FormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent,
    CluesComponent
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
  exports: [
    GameBoardComponent,
    GameComponent,
    CluesComponent
  ]
})
export class ComponentsModule {
}
