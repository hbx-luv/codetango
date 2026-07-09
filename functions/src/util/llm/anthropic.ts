import Anthropic from '@anthropic-ai/sdk';

import {anthropicApiKey} from './secrets';
import {LlmProvider, LlmRequest, ProviderName} from './types';

// Callers that don't pin a model get the capable one: clue generation defaults
// here because a bad clue can lose the game on the assassin. Cheap tasks (themed
// word lists) pass a smaller model explicitly via LlmRequest.model.
const DEFAULT_MODEL = 'claude-opus-4-8';

export class AnthropicProvider implements LlmProvider {
  readonly name: ProviderName = 'anthropic';

  async complete(req: LlmRequest): Promise<string> {
    // NOTE: the TS SDK's `timeout` is in MILLISECONDS (unlike Python's seconds).
    const client = new Anthropic({
      apiKey: anthropicApiKey.value(),
      timeout: 60000,
      maxRetries: 2,
    });

    try {
      const response = await client.messages.create({
        model: req.model ?? DEFAULT_MODEL,
        // 16000 is the safe non-streaming ceiling. With adaptive thinking +
        // effort 'high' (the clue request), thinking tokens count against
        // max_tokens, so a very hard board can in principle truncate the JSON.
        // The router then treats the unparseable output as a provider failure
        // rather than returning a bad clue — an accepted trade-off, not a bug.
        max_tokens: 16000,
        messages: [{role: 'user', content: req.prompt}],
        // Structured output is a hint to the model; the router's validator is
        // the contract. `effort` is only sent when set — it is model-dependent
        // and Haiku 4.5 rejects it. Omitting `thinking` means no thinking.
        output_config: {
          format: {type: 'json_schema', schema: req.schema},
          ...(req.effort ? {effort: req.effort} : {}),
        },
        ...(req.thinking ? {thinking: req.thinking} : {}),
      });

      // Concatenate text blocks; skip thinking blocks (present when adaptive
      // thinking is on).
      const parts: string[] = [];
      for (const block of response.content) {
        if (block.type === 'text') {
          parts.push(block.text);
        }
      }
      return parts.join('');
    } catch (e) {
      // Log typed SDK errors most-specific-first, then rethrow so the router
      // falls through. Never string-match error messages. (The TS SDK exposes
      // RateLimitError/APIConnectionError/APIError; APIConnectionError is a
      // subclass of APIError, so it must be checked first.)
      if (e instanceof Anthropic.RateLimitError) {
        console.error(
            `anthropic provider: rate limited (status ${e.status})`, e.message);
      } else if (e instanceof Anthropic.APIConnectionError) {
        console.error('anthropic provider: connection error', e.message);
      } else if (e instanceof Anthropic.APIError) {
        console.error(
            `anthropic provider: API error (status ${e.status})`, e.message);
      } else {
        console.error('anthropic provider: unexpected error', e);
      }
      throw e;
    }
  }
}
