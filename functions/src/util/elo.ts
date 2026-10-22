import {firestore} from 'firebase-admin';

import {
  Game,
  GameStatus,
  Stats,
  StatsSet,
  Team,
  UserStats,
  UserToUserStats,
} from '../types';

import {BigBatch} from './big-batch';
import {getChange} from './elo-math';
import {collectionsFor, getLiveSet, USER_STATS_STAGING} from './stats-sets';

// elo variables
const BASE_ELO = 1200;
// removed this for now (set to 0), not sure I like the results - MT
const PROVISIONAL_GAMES = 0;

// Max completed games to process in a single recalcElo invocation. Chosen so
// the Cloud Function stays well under its execution timeout.
export const RECALC_GAMES_PER_BATCH = 100;

interface UserMap {
  [field: string]: Stats;
}

// each key in this map is a given user's id
// the value is a map of other users' ids pointing to UserToUserStats
// this map should hold the latest stats between users
interface UserToUserMap {
  [field: string]: {
    [field: string]: UserToUserStats,
  };
}

export interface RecalcOptions {
  // When true, the recalc is part of an admin job building the inactive
  // history set: final per-user stats go to userStatsStaging instead of
  // users/{id}.stats, and the function does NOT auto-chain via admin/recalc —
  // the job runner drives chaining.
  staged?: boolean;

  // Which history set to read prior state from and write new state into.
  // Defaults to whichever set /system/stats says is live.
  set?: StatsSet;

  // Overrides the default per-invocation game limit.
  gamesLimit?: number;

  // Live chain only: how many pages the chain has processed so far. Purely
  // for logs — there is no cap.
  hops?: number;
}

export interface RecalcResult {
  // Number of completed games this invocation processed.
  processed: number;
  // completedAt of the last game processed, or the input timestamp if none.
  lastTimestamp: number;
}

/**
 * Everything one recalc pass carries between games: the stats maps that
 * roll forward from game to game, the batch the history docs land in, and
 * which history set they're read from and written to.
 *
 * Games fed to `processGame` must arrive in completedAt order, and for any
 * user already in `userMap` every game they played in between must have
 * gone through this same context — the maps are only re-read from the
 * history set on first sight of a user.
 */
export interface RecalcContext {
  db: any;
  set: StatsSet;
  historyCollection: string;
  u2uHistoryCollection: string;
  userMap: UserMap;
  userToUserMap: UserToUserMap;
  batch: BigBatch;
  // Every user any game in this pass has involved, so the commit phase
  // knows whose stats to refresh.
  touched: Set<string>;
}

export function createRecalcContext(db: any, set: StatsSet): RecalcContext {
  const {elo, u2u} = collectionsFor(set);
  return {
    db,
    set,
    historyCollection: elo,
    u2uHistoryCollection: u2u,
    userMap: {},
    userToUserMap: {},
    batch: new BigBatch(db),
    touched: new Set(),
  };
}

/**
 * Fold one completed game into the context: roll every player's stats and
 * head-to-head records forward and queue their history docs on the batch.
 */
export async function processGame(ctx: RecalcContext, game: Game):
    Promise<void> {
  const {db, userMap, userToUserMap, batch} = ctx;
  const userIds = game.blueTeam.userIds.concat(game.redTeam.userIds);
  for (const userId of userIds) ctx.touched.add(userId);

  // set the userIds for the completed game. Only write when it actually
  // changed: every game write fires onUpdateGame, and a recalc that touches
  // every game would otherwise fan out into thousands of no-op triggers.
  if (!sameArray(userIds, game.userIds)) {
    batch.update(db.collection('games').doc(game.id!), {userIds});
  }

  // ensure all of the users are in the userMap before
  // passing that off to the elo function
  await populateUserMap(db, userMap, game, ctx.historyCollection);

  // populate the userToUserMap as well, using the userMap to get the record
  // for current nemesis and ally for each player
  await populateUserToUserMap(
      db, userToUserMap, userMap, game, ctx.u2uHistoryCollection);

  // the setStats method will update several stats in the userMap and
  // userToUserMap for each user that played in the game
  setStats(game, userMap, userToUserMap);

  // update history for all users involved
  for (const myUserId of userIds) {
    batch.set(
        db.collection(ctx.historyCollection).doc(`${myUserId}_${game.id}`),
        {
          // clone the object and set gameId and timestamp
          ...userMap[myUserId],
          gameId: game.id,
          timestamp: game.completedAt,
        },
    );

    // save each combination of the users to the userToUserHistoryCollection
    for (const theirUserId of userIds) {
      if (myUserId !== theirUserId) {
        batch.set(
            db.collection(ctx.u2uHistoryCollection)
                .doc(`${myUserId}_${theirUserId}_${game.id}`),
            {
              // clone the object and set gameId and timestamp
              ...userToUserMap[myUserId][theirUserId],
              gameId: game.id,
              timestamp: game.completedAt,
            },
        );
      }
    }
  }
}

/**
 * Write the final per-user stats for everyone the context touched and
 * commit the batch. Staged runs park the stats in userStatsStaging for the
 * job's commit phase; live runs write users/{id}.stats directly.
 */
export async function commitRecalc(ctx: RecalcContext, staged: boolean):
    Promise<void> {
  const {db, userMap, batch} = ctx;

  if (staged) {
    // Only record *who* was touched. The job's commit phase derives each
    // user's final stats from their latest doc in the build set, which is
    // right whether their last game was recomputed or carried over.
    for (const userId of ctx.touched) {
      batch.set(
          db.collection(USER_STATS_STAGING).doc(userId),
          {userId, updatedAt: Date.now()},
          {merge: true},
      );
    }
  } else {
    for (const [userId, data] of Object.entries(userMap)) {
      const updateData: firestore.UpdateData<any> = {
        'stats.elo': data.elo,
        'stats.gamesPlayed': data.gamesPlayed,
        'stats.gamesWon': data.gamesWon,
        'stats.spymasterGames': data.spymasterGames,
        'stats.spymasterWins': data.spymasterWins,
        'stats.spymasterStreak': data.spymasterStreak,
        'stats.spymasterBestStreak': data.spymasterBestStreak,
        'stats.assassinsAsSpymaster': data.assassinsAsSpymaster,
        'stats.currentStreak': data.currentStreak,
        'stats.bestStreak': data.bestStreak,
        'stats.provisional': data.provisional,
        'stats.lastPlayed': data.timestamp,
      };

      // we have to do these outside, because you cannot set undefined as a
      // value in firestore
      if (data.ally) {
        updateData['stats.ally'] = data.ally;
      }
      if (data.nemesis) {
        updateData['stats.nemesis'] = data.nemesis;
      }

      const userRef = db.collection('users').doc(userId);
      const userSnapshot = await userRef.get();
      if (userSnapshot.exists) {
        batch.update(userRef, updateData);
      }
    }
  }

  // wait for the batches to commit in order
  console.log('committing batches');
  await batch.commit();
}

/**
 * Recalculate every completed game from `timestamp` onward, one page at a
 * time. In live mode the function re-schedules itself through admin/recalc
 * until it runs out of games.
 */
export async function recalcElo(
    db: any,  // RIP, tried to import firestore.Firestore
    timestamp: number,
    deletedGame?: Game,
    options: RecalcOptions = {},
    ): Promise<RecalcResult> {
  const staged = options.staged ?? false;
  const gamesLimit = options.gamesLimit ?? RECALC_GAMES_PER_BATCH;
  const set = options.set ?? await getLiveSet(db);
  const ctx = createRecalcContext(db, set);

  const games = await db.collection('games')
                    .where('completedAt', '>=', timestamp)
                    .orderBy('completedAt', 'asc')
                    .limit(gamesLimit)
                    .get();

  console.log(`${games.size} games got got. starting calc`);

  let lastTimestamp = timestamp;

  // if the game was deleted, we need to make sure the users in that
  // deleted game get added to the user map so their records get updated
  if (deletedGame) {
    console.log('adding users from deleted game', deletedGame);
    await populateUserMap(db, ctx.userMap, deletedGame, ctx.historyCollection);
    await populateUserToUserMap(
        db, ctx.userToUserMap, ctx.userMap, deletedGame,
        ctx.u2uHistoryCollection);
  }

  for (let i = 0; i < games.size; i++) {
    const game = games.docs[i].data() as Game;
    game.id = games.docs[i].id;
    await processGame(ctx, game);
    lastTimestamp = game.completedAt!;
  }

  console.log('done with games, iterating through users');
  await commitRecalc(ctx, staged);

  // In live mode, self-schedule the next batch via admin/recalc so
  // onCreateAdmin picks it up. In staged mode, the job runner is in charge.
  //
  // The chain is monotonic: every page starts strictly after the page that
  // scheduled it, and there are finitely many games, so it always ends.
  // `chainedFrom` lets the handler verify that and refuse anything that
  // would revisit earlier history — the only way a chain could ever loop.
  if (!staged && lastTimestamp > timestamp) {
    const hops = (options.hops ?? 0) + 1;
    console.log(`scheduling a new recalc starting from ${lastTimestamp} (hop ${
        hops})`);
    const ref = db.collection('admin').doc('recalc');
    // onDocumentCreated needs a create; clear a stale command first, but
    // never delete a doc that isn't there (the emulator fires a bogus
    // create event for that, and the handler would loop on it).
    if ((await ref.get()).exists) await ref.delete();
    await ref.set({timestamp: lastTimestamp, chainedFrom: timestamp, hops});
  }

  return {processed: games.size, lastTimestamp};
}

// Extract the storable UserStats out of a Stats snapshot. Mirrors the
// dot-path field list used in live mode above.
export function statsToUserStats(data: Stats): UserStats {
  const stats: UserStats = {
    elo: data.elo,
    gamesPlayed: data.gamesPlayed,
    gamesWon: data.gamesWon,
    spymasterGames: data.spymasterGames,
    spymasterWins: data.spymasterWins,
    spymasterStreak: data.spymasterStreak,
    spymasterBestStreak: data.spymasterBestStreak,
    assassinsAsSpymaster: data.assassinsAsSpymaster,
    currentStreak: data.currentStreak,
    bestStreak: data.bestStreak,
    provisional: data.provisional,
    lastPlayed: data.timestamp,
  };
  if (data.ally) stats.ally = data.ally;
  if (data.nemesis) stats.nemesis = data.nemesis;
  return stats;
}

async function populateUserMap(
    db: any, userMap: UserMap, game: Game, historyCollection: string) {
  for (const userId of game.blueTeam.userIds.concat(game.redTeam.userIds)) {
    if (userMap[userId] === undefined) {
      userMap[userId] = await getEloHistoryForUser(
          db, userId, game.id!, game.completedAt!, historyCollection);
    }
  }
}

/**
 * Get the last known elo before the given timestamp
 * Doing it this way ensure we don't need to nuke the elo history
 */
export async function getEloHistoryForUser(
    db: any,
    userId: string,
    gameId: string,
    timestamp: number,
    collectionName: string,
    ): Promise<Stats> {
  const snapshot = await db.collection(collectionName)
                       .orderBy('timestamp', 'desc')  // desc is most recent
                       .where('userId', '==', userId)
                       .where('timestamp', '<', timestamp)
                       .limit(1)
                       .get();

  // there should only be 1 document per user
  // if there are none, then set up a base Stats object
  return snapshot.size === 1 ? snapshot.docs[0].data() as Stats : {
    userId,
    gameId,
    elo: BASE_ELO,
    gamesPlayed: 0,
    gamesWon: 0,
    spymasterGames: 0,
    spymasterWins: 0,
    spymasterStreak: 0,
    spymasterBestStreak: 0,
    assassinsAsSpymaster: 0,
    currentStreak: 0,
    bestStreak: 0,
    provisional: true,
    timestamp: timestamp,
  };
}

async function populateUserToUserMap(
    db: any,
    userTouserMap: UserToUserMap,
    userMap: UserMap,
    game: Game,
    u2uHistoryCollection: string,
) {
  const userIds = game.blueTeam.userIds.concat(game.redTeam.userIds);

  // build up all combinations of users to each other
  for (const myUserId of userIds) {
    // instantiate map if needed
    if (userTouserMap[myUserId] === undefined) {
      userTouserMap[myUserId] = {};
    }

    // get ally and nemesis userIds as well
    const {ally = '', nemesis = ''} = userMap[myUserId];

    for (const theirUserId of userIds.concat([ally, nemesis])) {
      // ignore self
      if (theirUserId && myUserId !== theirUserId) {
        // if missing relationship between me and them, get the last known doc
        if (userTouserMap[myUserId][theirUserId] === undefined) {
          userTouserMap[myUserId][theirUserId] =
              await getUserToUserHistoryForUser(
                  db, myUserId, theirUserId, game.id!, game.completedAt!,
                  u2uHistoryCollection);
        }
      }
    }
  }
}

/**
 * Get the last known stats between two users before the given timestamp
 */
export async function getUserToUserHistoryForUser(
    db: any,
    myUserId: string,
    theirUserId: string,
    gameId: string,
    timestamp: number,
    collectionName: string,
    ): Promise<UserToUserStats> {
  const snapshot = await db.collection(collectionName)
                       .orderBy('timestamp', 'desc')  // desc is most recent
                       .where('myUserId', '==', myUserId)
                       .where('theirUserId', '==', theirUserId)
                       .where('timestamp', '<', timestamp)
                       .limit(1)
                       .get();

  // there should only be 1 document per user
  // if there are none, then set up a base UserToUserStats object
  return snapshot.size === 1 ? snapshot.docs[0].data() as UserToUserStats : {
    myUserId,
    theirUserId,
    gameId,
    timestamp,
    totalGames: 0,
    totalWith: 0,
    totalAgainst: 0,
    wonWith: 0,
    wonAgainst: 0,
  };
}

function setStats(game: Game, userMap: UserMap, userToUserMap: UserToUserMap) {
  // update the stats for each user in the userMap
  const blueWon = game.status === GameStatus.BLUE_WON;
  const winningTeam = blueWon ? game.blueTeam : game.redTeam;
  const losingTeam = blueWon ? game.redTeam : game.blueTeam;

  const winnersRating = getTeamElo(winningTeam, userMap);
  const losersRating = getTeamElo(losingTeam, userMap);
  const delta = getChange(winnersRating, losersRating);

  // set stats for users on the winning team
  for (const winner of winningTeam.userIds) {
    const user = userMap[winner];
    user.elo += deltaWithProvisional(user.gamesPlayed, delta);
    user.gamesPlayed++;
    user.gamesWon++;
    user.currentStreak++;
    user.bestStreak = Math.max(user.bestStreak, user.currentStreak);

    // last played and provisional status
    user.timestamp = game.completedAt!;
    user.provisional = user.gamesPlayed < PROVISIONAL_GAMES;

    // this user was spymaster
    if (winningTeam.spymaster === winner) {
      user.spymasterGames++;
      user.spymasterWins++;
      user.spymasterStreak++;
      user.spymasterBestStreak =
          Math.max(user.spymasterBestStreak, user.spymasterStreak);
    }

    // update the userToUserStats for my teammates and my opponents
    const thisUserToUserMap = userToUserMap[winner];
    for (const theirUserId of winningTeam.userIds) {
      if (winner !== theirUserId) {
        thisUserToUserMap[theirUserId].totalGames++;
        thisUserToUserMap[theirUserId].totalWith++;
        thisUserToUserMap[theirUserId].wonWith++;
        maybeSetAlly(winner, theirUserId, userMap, userToUserMap);
      }
    }
    for (const theirUserId of losingTeam.userIds) {
      if (winner !== theirUserId) {
        thisUserToUserMap[theirUserId].totalGames++;
        thisUserToUserMap[theirUserId].totalAgainst++;
        thisUserToUserMap[theirUserId].wonAgainst++;
      }
    }
  }

  // set stats for users on the losing team
  for (const loser of losingTeam.userIds) {
    const user = userMap[loser];
    user.elo += -deltaWithProvisional(user.gamesPlayed, delta);
    user.gamesPlayed++;
    user.currentStreak = 0;

    // last played and provisional status
    user.timestamp = game.completedAt!;
    user.provisional = user.gamesPlayed < PROVISIONAL_GAMES;

    // this user was spymaster
    if (losingTeam.spymaster === loser) {
      user.spymasterGames++;
      user.spymasterStreak = 0;

      // track how many times this user has lead their team to click on the
      // assassin as spymaster
      if (game.blueAgents > 0 && game.redAgents > 0) {
        user.assassinsAsSpymaster++;
      }
    }

    // just update the totals for userToUserStats
    const thisUserToUserMap = userToUserMap[loser];
    for (const theirUserId of losingTeam.userIds) {
      if (loser !== theirUserId) {
        thisUserToUserMap[theirUserId].totalGames++;
        thisUserToUserMap[theirUserId].totalWith++;
      }
    }
    for (const theirUserId of winningTeam.userIds) {
      if (loser !== theirUserId) {
        thisUserToUserMap[theirUserId].totalGames++;
        thisUserToUserMap[theirUserId].totalAgainst++;
        maybeSetNemesis(loser, theirUserId, userMap, userToUserMap);
      }
    }
  }
}

function maybeSetAlly(
    myUserId: string,
    theirUserId: string,
    userMap: UserMap,
    userToUserMap: UserToUserMap,
) {
  // if the user currently has an ally, break out early if theirUserId's ally
  // stat isn't as good as the current ally
  const me = userMap[myUserId];
  const theirStats = userToUserMap[myUserId][theirUserId];
  const allyStats = userToUserMap[myUserId][me.ally || ''];
  if (allyStats && allyStats.wonWith >= theirStats.wonWith) {
    return;
  }

  // if we get here, either ally isn't set or this ally is better
  me.ally = theirUserId;
}

function maybeSetNemesis(
    myUserId: string,
    theirUserId: string,
    userMap: UserMap,
    userToUserMap: UserToUserMap,
) {
  // if the user currently has an nemesis, break out early if theirUserId's
  // nemesis stat isn't as good as the current nemesis
  const me = userMap[myUserId];
  const theirStats = userToUserMap[myUserId][theirUserId];
  const nemesisStats = userToUserMap[myUserId][me.nemesis || ''];
  if (nemesisStats && nemesisStats.wonAgainst >= theirStats.wonAgainst) {
    return;
  }

  // if we get here, either nemesis isn't set or this nemesis is better
  me.nemesis = theirUserId;
}

/**
 * Given the number of games a user has played, make the eloChange more drastic
 * the further they are from getting out of the provisional period. Earlier
 * games affect your elo rating more than later games.
 */
function deltaWithProvisional(gamesPlayed: number, eloChange: number): number {
  const multiplier = gamesPlayed < PROVISIONAL_GAMES ?
      Math.ceil((PROVISIONAL_GAMES - gamesPlayed) / 2) :
      1;
  return eloChange * multiplier;
}

export async function nukeHistoryForGame(
    db: any, collection: string, gameId: string): Promise<void> {
  const batch = new BigBatch(db);
  const snapshot =
      await db.collection(collection).where('gameId', '==', gameId).get();

  // delete every document with a timestamp >= to the one provided
  snapshot.docs.forEach((doc: firestore.DocumentSnapshot) => {
    batch.delete(db.collection(collection).doc(doc.id));
  });

  return batch.commit();
}

function sameArray(a: string[], b?: string[]): boolean {
  if (!b || a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

function getTeamElo(team: Team, userMap: UserMap) {
  // TODO: fancier team ratings for the delta changes, right now just average
  let totalElo = 0;
  for (const userId of team.userIds) {
    totalElo += userMap[userId].elo || BASE_ELO;
  }
  return totalElo / team.userIds.length;
}
