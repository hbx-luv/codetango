import {
  DEFAULT_STATS_SET,
  STATS_COLLECTIONS,
  StatsCollections,
  StatsConfig,
  StatsSet,
} from '../types';

export const SYSTEM = 'system';
export const STATS_CONFIG_DOC = 'stats';

// Job-scoped scratch collection: per-user final UserStats written during the
// recalculating phase and copied onto users/{id}.stats at commit. Cleared at
// the start and end of every job.
export const USER_STATS_STAGING = 'userStatsStaging';

export function collectionsFor(set: StatsSet): StatsCollections {
  return STATS_COLLECTIONS[set];
}

/**
 * Which history set clients are reading right now. Missing pointer doc means
 * the original collection names (blue) — so a fresh deploy needs no data
 * migration.
 */
export async function getLiveSet(db: any): Promise<StatsSet> {
  const snap = await db.collection(SYSTEM).doc(STATS_CONFIG_DOC).get();
  const config = snap.exists ? snap.data() as StatsConfig : undefined;
  return config?.liveSet === StatsSet.GREEN ? StatsSet.GREEN :
                                              DEFAULT_STATS_SET;
}
