import OpenAI from 'openai';

import {chatgptApiKey} from './secrets';
import {LlmProvider, LlmRequest, ProviderName} from './types';

export class OpenAiProvider implements LlmProvider {
  readonly name: ProviderName = 'openai';

  async complete(req: LlmRequest): Promise<string> {
    const openai = new OpenAI({apiKey: chatgptApiKey.value()});
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: req.prompt}],
    });

    const content = completion.choices[0]?.message?.content;
    // CRITICAL: do NOT swallow a missing body into '' — throw so the router
    // logs and falls through. (Silently returning '' was the live bug.)
    if (content == null || content === '') {
      throw new Error('openai provider: completion returned no content');
    }
    return content;
  }
}
