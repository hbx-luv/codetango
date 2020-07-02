import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GameHistoryPage } from './game-history.page';

const routes: Routes = [
  {
    path: '',
    component: GameHistoryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GameHistoryPageRoutingModule {}
