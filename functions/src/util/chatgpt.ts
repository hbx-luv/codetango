import {defineSecret} from 'firebase-functions/params';
import OpenAI from 'openai';

export const chatgptApiKey = defineSecret('CHATGPT_API_KEY');

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function promptChatGpt(
    prompt: string, errorMessage: string): Promise<string> {
  try {
    const openai = new OpenAI({apiKey: chatgptApiKey.value()});
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: prompt}],
    });
    return completion.choices[0]?.message?.content ?? errorMessage;
  } catch (_error) {
    return errorMessage;
  }
}

export async function getThemedWords(theme: string): Promise<string[]> {
  const prompt = `
    Your task is to generate a list of words to be used for a game of codenames. Each word will be one of the tiles in the board for this round. The user has provided a word to be used as a theme or a spark of inspiration for the words generated. This word will be provided below between triple single-quotes. Please generate as many words as you can for this theme. Minimum 30 words, maximum 100 words.
    Please only respond with a JSON structure. No explanations, no greeting, no additional words. Keep it as concise as possible, by just returning the JSON. Please return a JSON structure with the following keys where theme is the user-provided word and words is a string array of the words for the board: theme, words
    Theme: '''${theme}'''
  `;

  try {
    const response = await promptChatGpt(prompt, '');
    const {words = []} = JSON.parse(response) as {words?: string[]};
    return shuffle(words).slice(0, 25);
  } catch (e) {
    console.log(e);
    return [];
  }
}
