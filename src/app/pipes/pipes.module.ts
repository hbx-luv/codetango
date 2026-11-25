import {NgModule} from '@angular/core';

import {TileSrcPipe} from './tile-src.pipe';

@NgModule({
  declarations: [TileSrcPipe],
  exports: [TileSrcPipe],
})
export class PipesModule {
}
