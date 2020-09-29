// kFactor for elo algorithm, feel free to change
const kFactor = 32;

export function getExpected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, ((b - a) / 400)));
}

export function getChange(winnerRating: number, loserRating: number) {
  return Math.round(kFactor * (1 - getExpected(winnerRating, loserRating)));
}