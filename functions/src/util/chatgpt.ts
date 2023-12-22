// firebase functions:config:set chatgpt.apikey="YOURAPIKEY" -P prod
import * as functions from 'firebase-functions';
import {shuffle} from 'lodash';
import {ChatCompletionRequestMessage, Configuration, OpenAIApi} from 'openai';

const CHATGPT_API_KEY = functions.config().chatgpt.apikey;
const configuration = new Configuration({
  apiKey: CHATGPT_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function promptChatGpt(
    prompt: string, errorMessage: string): Promise<string> {
  const messages: ChatCompletionRequestMessage[] = [];

  messages.push({role: 'user', content: prompt});

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    const completion_text = completion?.data?.choices[0]?.message?.content;
    return completion_text || errorMessage;
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

    // parse out the links from the response from ChatGPT
    const {words = []} = JSON.parse(response);
    return shuffle(words).slice(0, 25);
  } catch (e) {
    console.log(e);
    return [];
  }
}