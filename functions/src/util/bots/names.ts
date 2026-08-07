// Fun, obviously-a-bot display names. Picked by index so runs are deterministic
// where possible (no Math.random dependency at module load).
const BOT_NAMES = [
  '🤖 Clue-de Bot',
  '🤖 HAL 9-Clues',
  '🤖 Botrick Stewart',
  '🤖 Wordsworth',
  '🤖 Guessy McGuessface',
  '🤖 Deep Thought',
  '🤖 Sir Guess-a-lot',
  '🤖 The Clue-nicorn',
];

export function botName(seed: number): string {
  return BOT_NAMES[Math.abs(seed) % BOT_NAMES.length];
}
