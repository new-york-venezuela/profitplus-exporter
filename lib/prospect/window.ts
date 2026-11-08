import { localDateKey } from '../local-date';

const DAY_MS = 86_400_000;

function keyToUtcDay(key: number): number {
  return Math.floor(Date.UTC(Math.floor(key / 10000), Math.floor((key % 10000) / 100) - 1, key % 100) / DAY_MS);
}

/** Last 12 complete ISO weeks: Monday 83 days before the most recent Sunday strictly before today, through that Sunday. */
export function prospectWindow(now: Date): { startKey: number; endKey: number } {
  const back = now.getDay() === 0 ? 7 : now.getDay();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 83);
  return { startKey: localDateKey(start), endKey: localDateKey(end) };
}

/** Weeks from the first invoice day to the window end (inclusive days, rounded up, minimum 1). */
export function weeksActive(firstKey: number, endKey: number): number {
  const days = keyToUtcDay(endKey) - keyToUtcDay(firstKey) + 1;
  return Math.max(1, Math.ceil(days / 7));
}
