import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {DirectivesModule} from 'src/app/directives/directives.module';

import {LeaderboardPageRoutingModule} from './leaderboard-routing.module';
import {LeaderboardPage} from './leaderboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LeaderboardPageRoutingModule,
    DirectivesModule,
  ],
  declarations: [LeaderboardPage]
})
export class LeaderboardPageModule {
}
