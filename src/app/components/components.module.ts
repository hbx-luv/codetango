import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from '@ionic/angular';
import {GameBoardComponent} from './game-board/game-board.component';

@NgModule({
  declarations: [
    GameBoardComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
  ],
  exports: [
    GameBoardComponent,
  ]
})
export class ComponentsModule {
}
