import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {DirectivesModule} from '../directives/directives.module';
import {ActionsPopoverPageComponent} from './actions-popover/actions-popover-page.component';
import {ActionsPopoverComponent} from './actions-popover/actions-popover.component';
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
import {SameTeamComponent} from './same-team/same-team.component';
import {TeamListsComponent} from './team-lists/team-lists.component';
import {TimerComponent} from './timer/timer.component';
import {UsersComponent} from './users/user.component';
import {VersusComponent} from './versus/versus.component';
import {WinRecordComponent} from './win-record/win-record.component';
import {WordHistoryComponent} from './word-history/word-history.component';


@NgModule({
  declarations: [
    GameBoardComponent,      GameComponent,
    GiveClueComponent,       UsersComponent,
    PregameComponent,        TimerComponent,
    UsersComponent,          TeamListsComponent,
    WordHistoryComponent,    GameCardComponent,
    EloChartComponent,       RoomListItemComponent,
    ClueComponent,           ChatBoxComponent,
    EloChangeComponent,      SameTeamComponent,
    VersusComponent,         WinRecordComponent,
    ActionsPopoverComponent, ActionsPopoverPageComponent,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    DirectivesModule,
  ],
  exports: [
    GameBoardComponent,      GameComponent,
    GiveClueComponent,       UsersComponent,
    PregameComponent,        TimerComponent,
    UsersComponent,          TeamListsComponent,
    WordHistoryComponent,    GameCardComponent,
    EloChartComponent,       RoomListItemComponent,
    ClueComponent,           ChatBoxComponent,
    EloChangeComponent,      SameTeamComponent,
    VersusComponent,         WinRecordComponent,
    ActionsPopoverComponent, ActionsPopoverPageComponent,
  ]
})
export class ComponentsModule {
}
