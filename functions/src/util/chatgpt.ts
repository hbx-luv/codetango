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

// Trim, drop empties, and dedupe the raw word list.
function cleanWords(words: string[]): string[] {
  return [...new Set(words.map(w => w.trim()).filter(w => w.length > 0))];
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
  return cleanWords(obj.words as string[]).length >= 25;
}

export async function getThemedWords(theme: string): Promise<string[]> {
  const prompt = `
    Your task is to generate a list of words to be used for a game of codenames. Each word will be one of the tiles in the board for this round. The user has provided a word to be used as a theme or a spark of inspiration for the words generated. This word will be provided below between triple single-quotes. Please generate as many words as you can for this theme. Minimum 30 words, maximum 100 words.
    Please only respond with a JSON structure. No explanations, no greeting, no additional words. Keep it as concise as possible, by just returning the JSON. Please return a JSON structure with the following keys where theme is the user-provided word and words is a string array of the words for the board: theme, words
    Theme: '''${theme}'''
  `;

  // Propagates AllProvidersFailedError on total failure rather than returning
  // []; the caller (generateNewGameTiles) catches and falls back.
  const result = await complete(
      {prompt, effort: 'low', schema: THEMED_WORDS_SCHEMA},
      isThemedWords,
      ['anthropic', 'openai'],
  );

  return shuffle(cleanWords(result.words)).slice(0, 25);
}
