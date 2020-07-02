import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
        import('./pages/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: ':id',
    loadChildren: () =>
        import('./pages/room/room.module').then(m => m.RoomPageModule)
  },
  {
    path: ':id/games',
    loadChildren: () => import('./pages/game-history/game-history.module')
                            .then(m => m.GameHistoryPageModule)
  },
  {
    path: ':id/games/:gameId',
    loadChildren: () => import('./pages/game-detail/game-detail.module')
                            .then(m => m.GameDetailPageModule)
  }
];

@NgModule({
  imports:
      [RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
