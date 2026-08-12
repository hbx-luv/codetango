import {onDocumentCreated, onDocumentUpdated} from 'firebase-functions/v2/firestore';

import {maybeRunBot, maybeStartGameForBots} from '../../util/bots';
import {anthropicApiKey} from '../../util/llm';

// Bots are ADDED entirely client-side: Firestore rules let any signed-in user
// create a `bot_*` user doc and seat it in a room/game directly, so the bot
// appears instantly with no server round trip. Functions only get involved
// once there are moves to make.

// These triggers run the bot brain in response to the same writes the rest of
// the app already makes. They bind the Anthropic secret because a bot action
// may call the LLM router. maybeRunBot is a no-op unless a bot actually fills
// the seat that needs to act, so these are cheap when no bots are playing.

// Turn changes and post-guess board state land as game updates. The generous
// timeout covers the drain loop in maybeRunBot: the lock-holding invocation
// performs every pending bot action (clue -> guesses -> pass -> ...) itself,
// which in an all-bot game can span several LLM calls.
export const onGameUpdateBot = onDocumentUpdated(
    {document: 'games/{gameId}', secrets: [anthropicApiKey], timeoutSeconds: 300},
    async (event) => {
      await maybeRunBot(event.params.gameId);
    });

// A freshly posted clue is the signal for a bot guesser to start guessing.
export const onClueCreateBot = onDocumentCreated(
    {
      document: 'games/{gameId}/clues/{clueId}',
      secrets: [anthropicApiKey],
      timeoutSeconds: 300,
    },
    async (event) => {
      await maybeRunBot(event.params.gameId);
    });

// Start the game server-side when both teams are ready and the red spymaster
// (who normally starts the game client-side) is a bot.
export const onRoomUpdateBot = onDocumentUpdated(
    'rooms/{roomId}', async (event) => {
      await maybeStartGameForBots(event.params.roomId);
    });
