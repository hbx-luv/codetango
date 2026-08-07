import * as admin from 'firebase-admin';
import {FieldValue} from 'firebase-admin/firestore';

import {Game, Room, TeamType, User} from '../../types';
import {botName} from './names';

try {
  admin.initializeApp();
} catch (_e) {
  // do nothing, this is fine
}
const db = admin.firestore();

export interface BotInvite {
  team: TeamType;          // RED | BLUE
  asSpymaster?: boolean;
  createdAt?: number;
}

/**
 * React to a bot-invite doc: create a synthetic bot user (no auth account) and
 * seat it on the requested team, then delete the invite. Done server-side
 * because Firestore rules only let a user create their OWN user doc. Clients
 * add an invite doc and show a "joining soon" pill until the invite disappears
 * and the bot shows up on the team.
 */
export async function seatBotFromInvite(
    gameId: string, inviteId: string, invite: BotInvite): Promise<void> {
  const inviteRef = db.collection('games').doc(gameId).collection('bot-invites')
                        .doc(inviteId);
  const team = invite.team;
  if (team !== TeamType.RED && team !== TeamType.BLUE) {
    await inviteRef.delete();
    return;
  }

  const gameRef = db.collection('games').doc(gameId);
  const game = (await gameRef.get()).data() as Game | undefined;
  if (!game) {
    await inviteRef.delete();
    return;
  }

  const existingBots = (game.redTeam.userIds || [])
                           .concat(game.blueTeam.userIds || [])
                           .filter(id => id.startsWith('bot_')).length;
  const botId = `bot_${db.collection('users').doc().id}`;
  const bot: User = {
    name: botName(existingBots),
    email: '',
    rooms: game.roomId ? [game.roomId] : [],
    isBot: true,
  };
  await db.collection('users').doc(botId).set(bot);

  const teamKey = team === TeamType.RED ? 'redTeam' : 'blueTeam';
  const otherKey = team === TeamType.RED ? 'blueTeam' : 'redTeam';
  const updates: Record<string, unknown> = {
    [`${teamKey}.userIds`]: FieldValue.arrayUnion(botId),
    [`${otherKey}.userIds`]: FieldValue.arrayRemove(botId),
  };
  if (invite.asSpymaster) updates[`${teamKey}.spymaster`] = botId;
  await gameRef.update(updates);

  // Invite fulfilled: remove it so the "joining soon" pill clears.
  await inviteRef.delete();
}

/**
 * Lobby (PREGAME) variant: add a bot to the ROOM's player pool. It then counts
 * as an active player (see PresenceService.isActive) so "Assign Teams"
 * distributes it into a spymaster/guesser seat like any other player.
 */
export async function seatRoomBotFromInvite(
    roomId: string, inviteId: string): Promise<void> {
  const inviteRef = db.collection('rooms').doc(roomId).collection('bot-invites')
                        .doc(inviteId);
  const roomRef = db.collection('rooms').doc(roomId);
  const room = (await roomRef.get()).data() as Room | undefined;
  if (!room) {
    await inviteRef.delete();
    return;
  }

  const existingBots =
      (room.userIds || []).filter(id => id.startsWith('bot_')).length;
  const botId = `bot_${db.collection('users').doc().id}`;
  const bot: User = {
    name: botName(existingBots),
    email: '',
    rooms: [roomId],
    isBot: true,
  };
  await db.collection('users').doc(botId).set(bot);

  await roomRef.update({
    userIds: FieldValue.arrayUnion(botId),
    spectatorIds: FieldValue.arrayRemove(botId),
  });
  await inviteRef.delete();
}
