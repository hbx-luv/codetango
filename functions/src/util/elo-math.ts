// kFactor for elo algorithm, feel free to change
const kFactor = 50;
​
// base score for calculating ratios if games go to less than 10
const maxScore = 10;
​
// Increasing the win weight to 1.2 for example would give a slight
const winWeight = 1;
​
// Player A having 800 more points than Player B means
// Player A is 10x more likely to beat player B than
// Player B is to beat Player A
const spread = 800;

/**
 * Given two ratings and two scores, return the elo change relating
 * to the first rating. The opposite will be the change for the second
 * @param rating1 The rating of the winning player/team
 * @param rating2 The rating of the losing player/team
 * @param score1 The score of the winning player/team
 * @param score2 The score of the losing player/team
 */
export function eloDelta(
    rating1: number,
    rating2: number,
    score1: number,
    score2: number,
) {
  // elo math please never quiz me on this
  const expected_a = 1 / (1 + 10 ** ((rating2 - rating1) / spread));
  let outcome_a = score1 / (score1 + score2);
  ​
  // in the case of a tie, it doesn't make sense to use a win weight
  // on either player, it makes the calculation weird
  // this is completely irrelevant if winWeight is set to 1 above
  const weight = score1 === score2 ? 1 : winWeight;
  ​
  // a won
  if (outcome_a < 0.5) {
    outcome_a **= weight;
  }
  // b won
  else {
    outcome_a = 1 - (1 - outcome_a) ** weight;
  }
  ​
  // divide elo change to be smaller if it wasn't a full game to 10
  const ratio = Math.max(score1, score2) / maxScore;
  ​
  // calculate elo change
  return Math.round(kFactor * (outcome_a - expected_a) * ratio);
}