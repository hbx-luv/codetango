import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';

import {ComparePageRoutingModule} from './compare-routing.module';
import {ComparePage} from './compare.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ComparePageRoutingModule,
    ComponentsModule,
  ],
  declarations: [ComparePage]
})
export class ComparePageModule {
}
