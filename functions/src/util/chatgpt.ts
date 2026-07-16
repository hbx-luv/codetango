import {complete} from './llm';

// Re-exported for callers that historically imported the secret from here.
export {chatgptApiKey} from './llm';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface ThemedWords {
  theme: string;
  words: string[];
}

// `aiWordlistTheme` is free text typed by any player and interpolated into the
// prompt, and board words end up in the (large, per-doc) game document. Cap the
// theme before interpolation and bound the response so a crafted theme can't
// make the model emit arbitrarily long or numerous strings.
const MAX_THEME_LENGTH = 200;
const MAX_WORD_LENGTH = 30;
const MIN_WORD_COUNT = 25;
const MAX_WORD_COUNT = 200;

// JSON Schema for the structured-output hint. JSON Schema CANNOT express
// minItems/minLength, so the count/quality requirement lives in the validator.
const THEMED_WORDS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['theme', 'words'],
  properties: {
    theme: {type: 'string'},
    words: {type: 'array', items: {type: 'string'}},
  },
};

// Trim, drop empties, and dedupe the raw word list. Dedup is casefolded so
// visual duplicates (`Bat`/`bat`) collapse to one tile; the first-seen original
// casing is kept for display.
function cleanWords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const word = raw.trim();
    if (word.length === 0) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}

// The contract the router enforces: a well-shaped object with at least 25
// unique, non-empty, trimmed words. A short or duplicate-heavy list returns
// false → provider failure → fall through to the next provider.
function isThemedWords(v: unknown): v is ThemedWords {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.theme !== 'string') return false;
  if (!Array.isArray(obj.words)) return false;
  if (!obj.words.every(w => typeof w === 'string')) return false;
  const cleaned = cleanWords(obj.words as string[]);
  // Enough unique words, not an absurd number, and no oversized word — an
  // oversized or oversized-count response is treated as a provider failure.
  if (cleaned.length < MIN_WORD_COUNT || cleaned.length > MAX_WORD_COUNT) {
    return false;
  }
  if (cleaned.some(w => w.length > MAX_WORD_LENGTH)) return false;
  return true;
}

export async function getThemedWords(theme: string): Promise<string[]> {
  // Cap the untrusted, player-supplied theme before interpolating it into the
  // prompt so a huge theme string can't blow up the request.
  const safeTheme = theme.slice(0, MAX_THEME_LENGTH);
  const prompt = `
    You are generating word tiles for a game of Codenames. In Codenames, a spymaster gives a one-word clue that links several of their team's words, so the fun of the board depends entirely on the words chosen. Generate a set of candidate words inspired by a theme the user provides (given below between triple single-quotes).

    Rules for every word:
    - A single, common English word. No spaces, no hyphens, no phrases, no proper nouns (unless the theme is inherently about a specific person, place, or brand).
    - Concrete and evocative — something a casual player instantly recognizes and can picture. Prefer nouns, with a few strong verbs or adjectives mixed in.
    - Favor words with multiple distinct meanings or rich associations (e.g. BOND, SPRING, BUG, PALM, NIGHT). Words that can be read more than one way make for the most interesting clues.

    Rules for the set as a whole:
    - Every word must be distinct. No two words that are plurals of each other, share an obvious root, or are near-synonyms (avoid pairs like SEA/OCEAN or DOG/PUPPY).
    - Let the theme loosely inspire the words rather than tightly define them. Mix words that are clearly on-theme with words the theme merely brings to mind, so the board can't be swept with a single obvious clue. Aim for variety of meaning across the set.
    - Provide between 40 and 60 words.

    Respond with only a JSON object — no explanation, no greeting, no markdown fences. Use exactly these keys: "theme" (the user-provided word) and "words" (an array of uppercase strings).
    Theme: '''${safeTheme}'''
  `;

  // Propagates AllProvidersFailedError on total failure rather than returning
  // []; the caller (generateNewGameTiles) catches and falls back.
  // A themed word-association list doesn't need a frontier model — use the
  // cheap one. Haiku 4.5 rejects output_config.effort, so effort is omitted
  // (it supports structured outputs, so the JSON contract still holds).
  const result = await complete(
      {prompt, schema: THEMED_WORDS_SCHEMA, model: 'claude-haiku-4-5'},
      isThemedWords,
      ['anthropic', 'openai'],
  );

  return shuffle(cleanWords(result.words)).slice(0, 25);
}
