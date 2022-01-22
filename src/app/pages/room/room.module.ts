import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';
import {DirectivesModule} from 'src/app/directives/directives.module';

import {RoomPageRoutingModule} from './room-routing.module';
import {RoomPage} from './room.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RoomPageRoutingModule,
    ComponentsModule,
    DirectivesModule,
  ],
  declarations: [RoomPage]
})
export class RoomPageModule {
}
