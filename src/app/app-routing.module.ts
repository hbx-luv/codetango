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
  },
  {
    path: ':id/leaderboard',
    loadChildren: () => import('./pages/leaderboard/leaderboard.module')
                            .then(m => m.LeaderboardPageModule)
  },
  {
    path: 'scorecard/:id',
    loadChildren: () => import('./pages/scorecard/scorecard.module')
                            .then(m => m.ScorecardPageModule)
  },
  {
    path: 'all/rooms/games',
    loadChildren: () => import('./pages/game-history/game-history.module')
                            .then(m => m.GameHistoryPageModule)
  },
  {
    path: 'totally/doing/homework',
    loadChildren: () => import('./pages/generals/generals.module')
                            .then(m => m.GeneralsPageModule)
  },
];

@NgModule({
  imports:
      [RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
