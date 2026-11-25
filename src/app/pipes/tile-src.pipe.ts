import {Pipe, PipeTransform} from '@angular/core';
import {Tile} from 'types';

import {getTileImageRef, isUploadRef} from '../components/game/tile-util';
import {ImageStoreService} from '../services/image-store.service';

/**
 * The src for a tile's image (or for a bare image ref), for use with the
 * async pipe: `tile | tileSrc: game.assetUrlPattern | async`. Emits null for
 * a plain word tile or an upload that no longer exists.
 *
 * On a plain <img>, bind it with [attr.src]: the value is null until an
 * upload resolves, and [src]="null" makes the browser request "/null".
 */
@Pipe({standalone: false, name: 'tileSrc'})
export class TileSrcPipe implements PipeTransform {
  constructor(private readonly imageStore: ImageStoreService) {}

  transform(tile: Pick<Tile, 'word'|'image'>|string|null, assetUrlPattern?: string):
      Promise<string|null> {
    const ref = typeof tile === 'string' ? tile :
        tile ? getTileImageRef(tile, assetUrlPattern) : undefined;
    if (!ref) {
      return Promise.resolve(null);
    }
    return isUploadRef(ref) ? this.imageStore.resolve(ref).catch(() => null) :
                              Promise.resolve(ref);
  }
}
