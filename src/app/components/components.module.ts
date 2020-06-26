import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from '@ionic/angular';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameComponent} from './game/game.component';

@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent
  ],
  imports: [
    IonicModule,
    CommonModule,
  ],
  exports: [
    GameBoardComponent,
    GameComponent
  ]
})
export class ComponentsModule {
}
