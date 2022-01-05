import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
// import {TooltipModule} from 'ng2-tooltip-directive';
import {ComponentsModule} from 'src/app/components/components.module';

import {ScorecardPageRoutingModule} from './scorecard-routing.module';
import {ScorecardPage} from './scorecard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScorecardPageRoutingModule,
    ComponentsModule,
    // TooltipModule.forRoot({
    //   'placement': 'bottom',
    //   'hide-delay': 0,
    //   'displayTouchscreen': false,
    // }),
  ],
  declarations: [ScorecardPage]
})
export class ScorecardPageModule {
}
