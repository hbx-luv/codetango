import {DateTime} from 'luxon';

export function getMidnight(daysAgo: number = 0) {
  return DateTime.local()
      .minus({days: daysAgo})
      .setZone('America/Boise')
      .startOf('day')
      .toMillis();
}