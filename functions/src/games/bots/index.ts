import {onDocumentCreated, onDocumentUpdated} from 'firebase-functions/v2/firestore';

import {BotInvite, maybeRunBot, maybeStartGameForBots, seatBotFromInvite, seatRoomBotFromInvite} from '../../util/bots';
import {anthropicApiKey} from '../../util/llm';

// A client "invites" a bot by adding a doc to games/{gameId}/bot-invites. This
// trigger creates the bot user, seats it on the team, and deletes the invite.
// Reacting to a write (instead of a callable) keeps the click instant and lets
// the UI show a "joining soon" pill from the pending invite doc.
export const onCreateBotInvite = onDocumentCreated(
    'games/{gameId}/bot-invites/{inviteId}', async (event) => {
      const data = event.data?.data() as BotInvite | undefined;
      if (!data) return;
      await seatBotFromInvite(
          event.params.gameId, event.params.inviteId, data);
    });

// Lobby variant: invite a bot into the ROOM's player pool (before teams exist),
// so a solo host can add bots and then "Assign Teams" to fill the seats.
export const onCreateRoomBotInvite = onDocumentCreated(
    'rooms/{roomId}/bot-invites/{inviteId}', async (event) => {
      await seatRoomBotFromInvite(event.params.roomId, event.params.inviteId);
    });

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
