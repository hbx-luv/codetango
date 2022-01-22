import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {TooltipModule} from 'ng2-tooltip-directive';
import {ComponentsModule} from 'src/app/components/components.module';

import {RoomPageRoutingModule} from './room-routing.module';
import {RoomPage} from './room.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RoomPageRoutingModule,
    ComponentsModule,
    TooltipModule.forRoot({
      'placement': 'bottom',
      'hide-delay': 0,
      'displayTouchscreen': false,
    }),
  ],
  declarations: [RoomPage]
})
export class RoomPageModule {
}
