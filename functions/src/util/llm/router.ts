import {AnthropicProvider} from './anthropic';
import {OpenAiProvider} from './openai';
import {AllProvidersFailedError, LlmProvider, LlmRequest, ProviderName} from './types';

// Providers are constructed once. Their constructors do NOT read secrets —
// secret `.value()` is only called at request time inside `complete`, so this
// is safe to evaluate at module load in the Functions runtime.
const providers: Record<ProviderName, LlmProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAiProvider(),
};

/**
 * Run a completion through each provider in `chain` until one returns a value
 * that parses as JSON and passes `validate`. A network error, SDK error, JSON
 * parse failure, and validator rejection are all treated identically: log which
 * provider failed and why, then fall through to the next provider. Throws
 * AllProvidersFailedError if every provider in the chain fails.
 */
export async function complete<T>(
    req: LlmRequest,
    validate: (v: unknown) => v is T,
    chain: ProviderName[],
    ): Promise<T> {
  for (const providerName of chain) {
    const provider = providers[providerName];
    try {
      const raw = await provider.complete(req);
      const parsed = JSON.parse(raw) as unknown;
      if (!validate(parsed)) {
        throw new Error('response failed validation');
      }
      return parsed;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error(`llm provider "${providerName}" failed: ${reason}`);
      // fall through to the next provider in the chain
    }
  }

  throw new AllProvidersFailedError(
      `all providers failed for chain [${chain.join(', ')}]`);
}
