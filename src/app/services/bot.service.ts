import {Injectable} from '@angular/core';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  Firestore,
  getDoc,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {Game, Room, User} from 'types';

// Fun, obviously-a-bot display names. A new bot takes the first name not
// already used by a bot in its room/game. No emoji here — the bot look comes
// from the robot avatar app-user renders for isBot users.
const BOT_NAMES = [
  'Clue-de Bot',
  'HAL 9-Clues',
  'Botrick Stewart',
  'Wordsworth',
  'Guessy McGuessface',
  'Deep Thought',
  'Sir Guess-a-lot',
  'The Clue-nicorn',
];

// Bots created before the avatar change have a "🤖 " baked into their name;
// strip it so name-uniqueness checks treat them as the same name.
function normalizeBotName(name: string): string {
  return name.replace(/^🤖\s*/, '');
}

@Injectable({providedIn: 'root'})
export class BotService {
  constructor(private readonly firestore: Firestore) {}

  /**
   * Add a bot straight into the room's player pool (lobby / PREGAME). The bot
   * user doc is created client-side — Firestore rules allow any signed-in user
   * to create a `bot_*` user — so the bot appears in the lobby immediately.
   * Bots don't need any server-side setup until the game is underway; the
   * onWrite bot triggers pick them up once there are moves to make.
   */
  async addBotToRoom(room: Room): Promise<string> {
    const botId = await this.createBotUser(room.userIds ?? [], room.id);
    await updateDoc(doc(this.firestore, 'rooms', room.id), {
      userIds: arrayUnion(botId),
      spectatorIds: arrayRemove(botId),
    });
    return botId;
  }

  /**
   * Seat a bot directly on a team of an existing game (ASSIGNING_ROLES or
   * mid-game backfill).
   */
  async addBotToTeam(
      game: Game, team: 'redTeam'|'blueTeam',
      asSpymaster = false): Promise<string> {
    const seated = [
      ...(game.redTeam.userIds ?? []),
      ...(game.blueTeam.userIds ?? []),
    ];
    const botId = await this.createBotUser(seated, game.roomId);
    const updates: {[field: string]: unknown} = {
      [`${team}.userIds`]: arrayUnion(botId),
    };
    if (asSpymaster) {
      updates[`${team}.spymaster`] = botId;
    }
    await updateDoc(doc(this.firestore, 'games', game.id), updates);
    return botId;
  }

  /**
   * Remove a bot from the room's lists — unlike humans, bots don't move to
   * the spectator list. The bot's user doc (and any stats) stays around.
   */
  removeBotFromRoom(room: Room, botId: string) {
    if (!botId.startsWith('bot_')) {
      return;
    }
    return updateDoc(doc(this.firestore, 'rooms', room.id), {
      userIds: arrayRemove(botId),
      spectatorIds: arrayRemove(botId),
    });
  }

  /** Create the synthetic bot user doc (no auth account) and return its id. */
  private async createBotUser(existingUserIds: string[], roomId?: string):
      Promise<string> {
    const name = await this.pickName(existingUserIds);
    const botId = `bot_${doc(collection(this.firestore, 'users')).id}`;
    const bot: User = {
      name,
      email: '',
      rooms: roomId ? [roomId] : [],
      isBot: true,
    };
    await setDoc(doc(this.firestore, 'users', botId), bot);
    return botId;
  }

  /**
   * First pool name not already used by a bot among the given users; falls
   * back to a numbered round ("🤖 Wordsworth 2") if all names are taken.
   */
  private async pickName(existingUserIds: string[]): Promise<string> {
    const botIds = existingUserIds.filter(id => id.startsWith('bot_'));
    const usedNames = await Promise.all(botIds.map(async id => {
      const snap = await getDoc(doc(this.firestore, 'users', id));
      return (snap.data() as User | undefined)?.name;
    }));
    const used =
        new Set(usedNames.filter(Boolean).map(name => normalizeBotName(name)));
    const unused = BOT_NAMES.find(name => !used.has(name));
    if (unused) {
      return unused;
    }
    const round = Math.floor(botIds.length / BOT_NAMES.length) + 1;
    return `${BOT_NAMES[botIds.length % BOT_NAMES.length]} ${round}`;
  }
}
