import {GameType} from '../../../../types';

function getSrc(pattern: string, word: string) {
    const replacementToken = '{replace-me}';
    const src = pattern.replace(replacementToken, word);
    return src;
}

function buildAssetUrlPattern(gameType: GameType): string | undefined {
    const replacementToken = '{replace-me}';
    if (gameType === GameType.EMOJI_REMIX) {
        return `./assets/emoji-remix/${replacementToken}.png`;
    } else if (gameType === GameType.EMOJIS) {
        return `https://twitter.github.io/twemoji/2/72x72/${replacementToken}.png`;
    } else if (gameType === GameType.MEMES) {
        return `./assets/memes/${replacementToken}.jpg`;
    } else if (gameType === GameType.PICTURES) {
        return `./assets/pictures/smaller/${replacementToken}.png`;
    }
    return undefined;
}

export { getSrc, buildAssetUrlPattern };
