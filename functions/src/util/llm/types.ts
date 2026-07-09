export type ProviderName = 'anthropic'|'openai';

export type Effort = 'low'|'medium'|'high'|'xhigh'|'max';

// A single completion request. Providers return RAW TEXT from `complete`; the
// router owns JSON.parse + validation. `schema` is a JSON Schema hint used by
// providers that support structured output (Anthropic); the validator supplied
// to the router is the actual contract. Omit `thinking` for no thinking.
export interface LlmRequest {
  prompt: string;
  schema: Record<string, unknown>;
  // Effort is optional because it is model-dependent: Haiku 4.5 rejects
  // output_config.effort with a 400. Omit it for models/tasks that don't use it.
  effort?: Effort;
  thinking?: {type: 'adaptive'};
  // Anthropic model id. Optional; the Anthropic provider defaults to a capable
  // model when unset. The OpenAI provider ignores this (it uses its own model).
  model?: string;
}

export interface LlmProvider {
  readonly name: ProviderName;
  // Returns the model's raw text response. Any failure (network, SDK, empty
  // body) must THROW so the router can log it and fall through — never return
  // a sentinel value.
  complete(req: LlmRequest): Promise<string>;
}

// Thrown by the router when every provider in the chain has failed (network
// error, SDK error, JSON parse failure, or validator rejection).
export class AllProvidersFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllProvidersFailedError';
  }
}
