import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {ComponentsModule} from 'src/app/components/components.module';
import {DirectivesModule} from 'src/app/directives/directives.module';

import {ScorecardPageRoutingModule} from './scorecard-routing.module';
import {ScorecardPage} from './scorecard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScorecardPageRoutingModule,
    ComponentsModule,
    DirectivesModule,
  ],
  declarations: [ScorecardPage]
})
export class ScorecardPageModule {
}
