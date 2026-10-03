import { addDaysIso } from './dates';
import type { PromotionStatus } from './promo-status';

export interface TimelineBar {
  id: number; name: string; status: PromotionStatus;
  startDay: number; endDay: number; clippedStart: boolean; clippedEnd: boolean; lane: number;
}

export function monthDays(monthStartIso: string): number {
  const [y, m] = monthStartIso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(monthStartIso: string, delta: number): string {
  const [y, m] = monthStartIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function timelineBars(
  promotions: { id: number; name: string; startsOn: string; endsOn: string; status: PromotionStatus }[],
  monthStartIso: string,
): TimelineBar[] {
  const days = monthDays(monthStartIso);
  const monthEnd = addDaysIso(monthStartIso, days - 1);
  const visible = promotions
    .filter(p => p.startsOn <= monthEnd && p.endsOn >= monthStartIso)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id);
  const laneEnds: string[] = []; // last end date occupying each lane
  return visible.map(p => {
    let lane = laneEnds.findIndex(end => end < p.startsOn);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(p.endsOn); } else laneEnds[lane] = p.endsOn;
    const clippedStart = p.startsOn < monthStartIso;
    const clippedEnd = p.endsOn > monthEnd;
    return {
      id: p.id, name: p.name, status: p.status, lane, clippedStart, clippedEnd,
      startDay: clippedStart ? 1 : Number(p.startsOn.slice(8, 10)),
      endDay: clippedEnd ? days : Number(p.endsOn.slice(8, 10)),
    };
  });
}
