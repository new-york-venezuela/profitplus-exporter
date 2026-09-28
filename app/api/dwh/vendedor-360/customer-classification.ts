// New/recovered customer classification for the Seller 360° profile. Pure
// function over pre-computed per-entity facts (built by the route from two
// SQL queries — first-ever-sale lookup and prior/current period activity) so
// the classification rule itself is unit-testable without a database. See
// docs/superpowers/specs/2026-09-27-seller-360-dashboard-design.md, Sections
// 7.4/7.5 and 10 ("new vs recovered mutual exclusivity").
//
// "New": the entity's first sale EVER (unbounded lookback) falls inside the
// selected period, and that first sale is attributed to this seller.
// "Recovered": the entity had at least one sale before the selected period,
// none in the immediately preceding comparison period, and a sale in the
// selected period attributed to this seller (recoverySale carries that
// sale's own date/amount plus the gap that preceded it). An entity can only
// be "new" OR "recovered", never both — a true "new" entity (zero sales
// ever before the period) cannot also have a qualifying prior sale to
// recover from, so this is enforced by preferring "new" whenever both
// conditions are (incorrectly) present in the input, rather than trusting
// the caller never produces that combination.

interface DualAmount {
  bs: number;
  usd: number | null;
}

export interface RecoverySaleInfo {
  lastSaleBeforeGap: string;
  gapDays: number;
  recoverySaleDate: string;
  recoverySaleAmount: DualAmount;
}

export interface EntitySaleHistory {
  legalEntityKey: number;
  legalEntityName: string;
  firstSaleDateEver: string;       // ISO date, unbounded lookback
  firstSaleSellerMatches: boolean; // whether that first-ever sale was made by the profile's seller
  firstSaleAmount: DualAmount;
  hadSaleInPriorPeriod: boolean;
  hadSaleInCurrentPeriod: boolean;
  recoverySale: RecoverySaleInfo | null;
}

export interface NewCustomerRow {
  legalEntityKey: number;
  legalEntityName: string;
  firstSaleDate: string;
  firstSaleAmount: DualAmount;
}

export interface RecoveredCustomerRow {
  legalEntityKey: number;
  legalEntityName: string;
  lastSaleBeforeGap: string;
  gapDays: number;
  recoverySaleDate: string;
  recoverySaleAmount: DualAmount;
}

function isNew(entity: EntitySaleHistory, periodStart: string, periodEnd: string): boolean {
  return entity.firstSaleSellerMatches
    && entity.firstSaleDateEver >= periodStart
    && entity.firstSaleDateEver <= periodEnd;
}

export function classifyCustomers(
  entities: EntitySaleHistory[],
  periodStart: string,
  periodEnd: string,
): { nuevos: NewCustomerRow[]; recuperados: RecoveredCustomerRow[] } {
  const nuevos: NewCustomerRow[] = [];
  const recuperados: RecoveredCustomerRow[] = [];

  for (const entity of entities) {
    if (isNew(entity, periodStart, periodEnd)) {
      nuevos.push({
        legalEntityKey: entity.legalEntityKey,
        legalEntityName: entity.legalEntityName,
        firstSaleDate: entity.firstSaleDateEver,
        firstSaleAmount: entity.firstSaleAmount,
      });
      continue; // "new" takes precedence — never also "recovered"
    }
    if (entity.recoverySale !== null) {
      recuperados.push({
        legalEntityKey: entity.legalEntityKey,
        legalEntityName: entity.legalEntityName,
        lastSaleBeforeGap: entity.recoverySale.lastSaleBeforeGap,
        gapDays: entity.recoverySale.gapDays,
        recoverySaleDate: entity.recoverySale.recoverySaleDate,
        recoverySaleAmount: entity.recoverySale.recoverySaleAmount,
      });
    }
  }

  return { nuevos, recuperados };
}
