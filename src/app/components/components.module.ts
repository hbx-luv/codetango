import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import { ok } from 'assert';
import {TooltipModule} from 'ng2-tooltip-directive';
import {ChatBoxComponent} from './chat-box/chat-box.component';

import {ClueComponent} from './clue/clue.component';
import {EloChangeComponent} from './elo-change/elo-change.component';
import {EloChartComponent} from './elo-chart/elo-chart';
import {GameBoardComponent} from './game-board/game-board.component';
import {GameCardComponent} from './game-card/game-card.component';
import {GameComponent} from './game/game.component';
import {GiveClueComponent} from './give-clue/give-clue.component';
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
    ChatBoxComponent,
    EloChangeComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TooltipModule.forRoot({
      /* tslint:disable object-literal-key-quotes */
      'placement': 'bottom',
      'hide-delay': 0,
      'displayTouchscreen': false,
      /* tslint:enable */
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
    ChatBoxComponent,
    EloChangeComponent,
  ]
})
export class ComponentsModule {
}
