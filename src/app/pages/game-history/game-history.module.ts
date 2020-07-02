import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {GameHistoryPageRoutingModule} from './game-history-routing.module';
import {GameHistoryPage} from './game-history.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GameHistoryPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [GameHistoryPage]
})
export class GameHistoryPageModule {
}
