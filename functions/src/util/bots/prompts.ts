import {CodenamesClueResponse} from '../../types';

// ---------- Spymaster (clue) ----------

export const CLUE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['hint', 'number', 'reason', 'targetWords'],
  properties: {
    hint: {type: 'string'},
    number: {type: 'integer'},
    reason: {type: 'string'},
    targetWords: {type: 'array', items: {type: 'string'}},
  },
};

export function isClueResponse(v: unknown): v is CodenamesClueResponse {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  // targetWords is requested via the schema but validated leniently: structured
  // output is only a hint (the router's guard is the contract), and rejecting a
  // clue that omits it would fail the anthropic-only clue chain and stall the
  // game. When present it must be an array of strings; when absent the message
  // falls back to the prose `reason`.
  const targetWordsOk = obj.targetWords === undefined ||
      (Array.isArray(obj.targetWords) &&
       obj.targetWords.every(w => typeof w === 'string'));
  return typeof obj.hint === 'string' && Number.isInteger(obj.number) &&
      typeof obj.reason === 'string' && targetWordsOk;
}

export function buildCluePrompt(
    playerWords: string[],
    opponentWords: string[],
    neutralWords: string[],
    bombWord: string,
    previousClues: string[],
    ): string {
  const previous = previousClues.length ? previousClues.join(', ') : '(none yet)';
  return `
You are an expert spymaster in the word game Codenames. Your job is to give a
one-word hint that connects as many of YOUR team's words as possible while
steering your teammates away from every other word on the board.

Board state (each list is a set of single words already on the board):
- YOUR team's words (you want your teammates to guess these): ${playerWords.join(', ')}
- Opponent's words (never lead your team here): ${opponentWords.join(', ')}
- Neutral bystander words (avoid these; a wrong guess ends your turn): ${neutralWords.join(', ')}
- The ASSASSIN word (if your team guesses this, you INSTANTLY LOSE - avoid it at all costs): ${bombWord}
- Hints already given to your team this game (do not reuse them): ${previous}

Rules for your hint:
1. The hint MUST be a single English word. It must NOT be any word appearing on
   the board (in any list above), nor a direct form, plural, or substring of one.
2. The number is how many of YOUR team's words your hint points to. Pick a hint
   that safely connects as many of your words as you confidently can, but never
   at the risk of pointing toward the assassin, an opponent word, or a neutral.
3. Favor a strong, unambiguous connection to your own words over a risky clue
   that touches more words. A clean 2 beats a dangerous 4.
4. Absolutely avoid any semantic path that could lead your team to the assassin
   word "${bombWord}".

Think it through, then respond with a JSON object with exactly these keys:
- "hint": your single-word clue (string)
- "number": the count of your team's words it points to (integer, at least 1)
- "reason": a short explanation of which of YOUR team's words the hint targets
  and why it points only to them (string). Do NOT mention, quote, or spell out
  the assassin word or any other word on the board in this explanation - refer
  to your own target words only.
- "targetWords": the exact list of YOUR team's board words you expect your
  operatives to find from this hint (array of strings, one entry per word the
  "number" counts). Use only words from YOUR team's list above.
Respond with only the JSON object and nothing else.
`;
}

// ---------- Guesser (guess / pass) ----------

export interface GuessResponse {
  action: 'guess'|'pass';
  word?: string;
  reason?: string;
}

export const GUESS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'reason'],
  properties: {
    action: {type: 'string', enum: ['guess', 'pass']},
    word: {type: 'string'},
    reason: {type: 'string'},
  },
};

export function isGuessResponse(v: unknown): v is GuessResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.action !== 'guess' && o.action !== 'pass') return false;
  if (o.action === 'guess' && typeof o.word !== 'string') return false;
  return typeof o.reason === 'string';
}

/**
 * Guesser prompt. Receives ONLY the clue and the role-stripped board (words +
 * already-revealed tiles). It is impossible for this prompt to leak the key
 * because callers build it from guesserView(), which never exposes the role of
 * an unrevealed tile.
 */
export function buildGuessPrompt(
    clueWord: string,
    clueNumber: string,
    unrevealed: string[],
    revealed: string[],
    guessesThisClue: string[],
    guessesRemaining: number,
    ): string {
  const numberMeaning = clueNumber === '0' ?
      `0 means AVOID: none of your team's tiles relate to "${
          clueWord}" - do NOT guess a tile associated with it` :
      clueNumber === '∞' ?
      'unlimited guesses toward the clue' :
      `about ${clueNumber} of your team's tiles relate to "${clueWord}"`;
  return `
You are an expert operative (guesser) in the word game Codenames. You see ONLY
the words on the board and the clue - you do NOT know which tiles belong to
which team. Guess purely by word-association with the clue.

Your spymaster's clue: "${clueWord}" ${clueNumber}
Number meaning: ${numberMeaning}

Unrevealed tiles you may guess (words only, colors unknown to you):
${unrevealed.join(', ')}

Already-revealed tiles (public info): ${revealed.length ? revealed.join(', ') : '(none)'}
Tiles your team already guessed for THIS clue: ${guessesThisClue.length ? guessesThisClue.join(', ') : '(none)'}
Guesses remaining this turn: ${guessesRemaining}

How to decide:
- Rank the unrevealed tiles by how strongly they associate with the clue word.
- A WRONG guess ends your team's turn immediately; guessing the assassin loses
  the game. So only guess a tile you are genuinely confident relates to the clue.
- You do not have to use every remaining guess. If no unrevealed tile is a
  clearly strong fit for the clue (beyond the ones you already got), PASS.
- Judge each tile only by its own association to the clue word. The fact that
  two board words relate to EACH OTHER tells you nothing about their team.

Respond with a JSON object with exactly these keys:
- "action": "guess" to reveal a tile, or "pass" to end the turn
- "word": if guessing, the exact board word to reveal (must be one of the
  unrevealed tiles above). Omit or leave empty when passing.
- "reason": one short sentence explaining your choice.
Respond with only the JSON object and nothing else.
`;
}
