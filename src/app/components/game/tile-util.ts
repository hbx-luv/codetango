import {GameType, IMAGE_REF_PREFIX, Tile} from '../../../../types';

const REPLACEMENT_TOKEN = '{replace-me}';

/**
 * Where the artwork for a built-in picture/emoji list lives. Tiles in those
 * games only hold an asset id; the pattern turns it into a URL.
 */
export function buildAssetUrlPattern(gameType: GameType): string|undefined {
  switch (gameType) {
    case GameType.EMOJI_REMIX:
      return `./assets/emoji-remix/${REPLACEMENT_TOKEN}.png`;
    case GameType.EMOJIS:
      return `https://twitter.github.io/twemoji/2/72x72/${REPLACEMENT_TOKEN}.png`;
    case GameType.MEMES:
      return `./assets/memes/${REPLACEMENT_TOKEN}.jpg`;
    case GameType.PICTURES:
      return `./assets/pictures/smaller/${REPLACEMENT_TOKEN}.png`;
    default:
      return undefined;
  }
}

/**
 * The image a tile should render, or undefined for a plain word tile. Tiles
 * from a player-made image list carry their own ref (a link, or an upload
 * ref that TileSrcPipe resolves); built-in art goes through the pattern.
 */
export function getTileImageRef(
    tile: Pick<Tile, 'word'|'image'>, assetUrlPattern?: string): string|
    undefined {
  if (tile.image) {
    return tile.image;
  }
  return assetUrlPattern ?
      assetUrlPattern.replace(REPLACEMENT_TOKEN, tile.word ?? '') :
      undefined;
}

export function isUploadRef(ref: string): boolean {
  return ref.startsWith(IMAGE_REF_PREFIX);
}

/** Only https links are accepted as image tiles. */
export function isImageLink(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch (_e) {
    return false;
  }
}
