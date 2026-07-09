import {defineSecret} from 'firebase-functions/params';

// Each secret is defined exactly once here so callable/trigger functions can
// declare them in their `secrets` array and providers can read them at runtime.
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
export const chatgptApiKey = defineSecret('CHATGPT_API_KEY');
