'use client';

import { localIsoDate } from '@/lib/local-date';
import { monthPace, resolveReferenceMonth } from '@/lib/seguimiento/month-pace';
import { MonthPaceStrip } from './seguimiento/visuals';
import type { DateRange } from '../types';

// Same reference-month rule as Seguimiento (resolveReferenceMonth): the month the selected range ends in,
// as of the earliest of today / range end / month end. Weekends-only working days (spec, "Working days").
export function ResumenPace({ dateRange, today }: { dateRange: DateRange; today?: string }) {
  const ref = resolveReferenceMonth(dateRange, today ?? localIsoDate());
  return <MonthPaceStrip pace={monthPace(ref.month, ref.asOf)} />;
}
