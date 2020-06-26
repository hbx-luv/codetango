import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {IonicModule} from '@ionic/angular';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameComponent} from './game/game.component';
import {CluesComponent} from './clues/clues.component';
import {FormsModule} from '@angular/forms';
import {TeamsComponent} from "./teams/teams.component";

@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent,
    CluesComponent,
    TeamsComponent
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
    TeamsComponent
  ]
})
export class ComponentsModule {
}
