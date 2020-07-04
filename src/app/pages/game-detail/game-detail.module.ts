import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {GameDetailPageRoutingModule} from './game-detail-routing.module';
import {GameDetailPage} from './game-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GameDetailPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [GameDetailPage]
})
export class GameDetailPageModule {
}
