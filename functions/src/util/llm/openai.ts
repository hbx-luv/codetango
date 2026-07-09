import OpenAI from 'openai';

import {chatgptApiKey} from './secrets';
import {LlmProvider, LlmRequest, ProviderName} from './types';

export class OpenAiProvider implements LlmProvider {
  readonly name: ProviderName = 'openai';

  async complete(req: LlmRequest): Promise<string> {
    // Explicit timeout/maxRetries to match the Anthropic provider (the OpenAI
    // SDK's own defaults are 10 min / 2 retries).
    const openai = new OpenAI({
      apiKey: chatgptApiKey.value(),
      timeout: 60000,
      maxRetries: 2,
    });
    // Force a JSON object response so prose / markdown-fenced output doesn't
    // fail JSON.parse in the router (which made this fallback a near no-op). The
    // model requires the word "json" somewhere in the prompt when this is set;
    // the themed-words prompt already says "JSON structure", which satisfies it.
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: req.prompt}],
      response_format: {type: 'json_object'},
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
