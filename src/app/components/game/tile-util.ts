function getSrc(word: string) {
    const replacementToken = '{replace-me}';
    const srcPattern = this.assetUrlPattern;
    const src = srcPattern.replace(replacementToken, word);
    return src;
}

export { getSrc };
