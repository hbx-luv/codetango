import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {TooltipModule} from 'ng2-tooltip-directive';

import {ClueComponent} from './clue/clue.component';
import {EloChartComponent} from './elo-chart/elo-chart';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameCardComponent} from './game-card/game-card.component';
import {GameComponent} from './game/game.component';
import {GiveClueComponent} from './give-clue/give-clue.component';
import {MessageComponent} from './message/message.component';
import {PregameComponent} from './pregame/pregame.component';
import {RoomListItemComponent} from './room-list-item/room-list-item.component';
import {TeamListsComponent} from './team-lists/team-lists.component';
import {TimerComponent} from './timer/timer.component';
import {UsersComponent} from './users/user.component';
import {WordHistoryComponent} from './word-history/word-history.component';


@NgModule({
  declarations: [
    GameBoardComponent,
    GameComponent,
    GiveClueComponent,
    UsersComponent,
    PregameComponent,
    TimerComponent,
    UsersComponent,
    TeamListsComponent,
    WordHistoryComponent,
    GameCardComponent,
    EloChartComponent,
    RoomListItemComponent,
    ClueComponent,
    MessageComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TooltipModule.forRoot({
      'placement': 'bottom',
      'hide-delay': 0,
      'displayTouchscreen': false,
    }),
  ],
  exports: [
    GameBoardComponent,
    GameComponent,
    GiveClueComponent,
    UsersComponent,
    PregameComponent,
    TimerComponent,
    UsersComponent,
    TeamListsComponent,
    WordHistoryComponent,
    GameCardComponent,
    EloChartComponent,
    RoomListItemComponent,
    ClueComponent,
    MessageComponent,
  ]
})
export class ComponentsModule {
}
