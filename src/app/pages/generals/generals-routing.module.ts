import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GeneralsPage } from './generals.page';

const routes: Routes = [
  {
    path: '',
    component: GeneralsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GeneralsPageRoutingModule {}
