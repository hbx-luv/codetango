import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {TooltipModule} from 'ng2-tooltip-directive';

import {LeaderboardPageRoutingModule} from './leaderboard-routing.module';
import {LeaderboardPage} from './leaderboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LeaderboardPageRoutingModule,
    TooltipModule.forRoot({
      'placement': 'bottom',
      'hide-delay': 0,
      'displayTouchscreen': false,
    }),
  ],
  declarations: [LeaderboardPage]
})
export class LeaderboardPageModule {
}
