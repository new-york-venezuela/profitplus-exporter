import type { ConnectionPool } from 'mssql';
import type { AppDb } from '@/lib/geo/routes-repo';
import { todayIso } from './dates';
import {
  endingSoon, lapsedPrices, strandedPromotions, sweepStatus, unrevertedSegments,
  type EndingSoonItem, type LapsedItem, type StrandedPromotion, type SweepStatus, type UnrevertedItem,
} from './health';
import { getLastSweepRun } from './health-repo';
import { listItems, listPromotions } from './promotions-repo';
import { promotionStatus } from './promo-status';
import { getSegmentMetaMap } from './segments-repo';
import * as erp from './rates-erp';
import type { RateRow } from './rate-planner';

export interface HealthErp {
  listListsInUse(): Promise<string[]>;                       // coPrecio with customerCount > 0
  readAllActiveRates(listCodes: string[]): Promise<RateRow[]>;
  countCustomersByTipCli(tipClis: string[]): Promise<Record<string, number>>;
}

export interface HealthReport {
  today: string;
  withinDays: number;
  endingSoon: EndingSoonItem[];
  unreverted: UnrevertedItem[];
  lapsed: LapsedItem[];
  stranded: StrandedPromotion[];
  sweep: SweepStatus;
}

export async function loadHealthReport(
  deps: { erp: HealthErp; db: AppDb; now?: () => Date },
  withinDays: number,
): Promise<HealthReport> {
  const now = (deps.now ?? (() => new Date()))();
  const today = todayIso(now);
  const promotions = listPromotions(deps.db);

  const metas = [...getSegmentMetaMap(deps.db).values()];
  const expiredSpecials = metas.filter(m => m.kind === 'special' && m.expiresAt !== null && m.expiresAt < today);
  // Counted live in the ERP, so a sweep that moved everyone (even though `moved` stays 1 afterwards) reports nothing here.
  const counts = expiredSpecials.length > 0 ? await deps.erp.countCustomersByTipCli(expiredSpecials.map(m => m.tipCli)) : {};

  const listsInUse = await deps.erp.listListsInUse();
  const rates = listsInUse.length > 0 ? await deps.erp.readAllActiveRates(listsInUse) : [];

  const itemsByPromotion: Record<number, ReturnType<typeof listItems>> = {};
  for (const p of promotions) {
    const status = promotionStatus(p, today);
    if (status === 'ended' || status === 'cancelled') itemsByPromotion[p.id] = listItems(deps.db, p.id);
  }

  const last = getLastSweepRun(deps.db);
  return {
    today,
    withinDays,
    endingSoon: endingSoon(promotions, today, withinDays),
    unreverted: unrevertedSegments(metas, counts, today),
    lapsed: lapsedPrices(rates, listsInUse, today),
    stranded: strandedPromotions(promotions, itemsByPromotion, today),
    sweep: sweepStatus(last && { runAt: last.runAt, ok: last.ok === 1, failed: last.failed, error: last.error }, now.getTime()),
  };
}

export function realHealthErp(pool: ConnectionPool): HealthErp {
  return {
    listListsInUse: () => erp.listListsInUse(pool),
    readAllActiveRates: codes => erp.readAllActiveRates(pool, codes),
    countCustomersByTipCli: codes => erp.countCustomersByTipCli(pool, codes),
  };
}
