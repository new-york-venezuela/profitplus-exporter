import { describe, test, expect } from 'bun:test';
import { classifyCustomers, type EntitySaleHistory } from './customer-classification';

describe('classifyCustomers', () => {
  test('classifies an entity as new when its first-ever sale falls in-period and matches the seller', () => {
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 1,
      legalEntityName: 'Cliente A',
      firstSaleDateEver: '2026-09-15',
      firstSaleSellerMatches: true,
      firstSaleAmount: { bs: 1000, usd: 100 },
      hadSaleInPriorPeriod: false,
      hadSaleInCurrentPeriod: true,
      recoverySale: null,
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    expect(result.nuevos).toHaveLength(1);
    expect(result.nuevos[0].legalEntityKey).toBe(1);
    expect(result.recuperados).toHaveLength(0);
  });

  test('does not classify as new when the first-ever sale was attributed to a different seller', () => {
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 2,
      legalEntityName: 'Cliente B',
      firstSaleDateEver: '2026-09-15',
      firstSaleSellerMatches: false,
      firstSaleAmount: { bs: 1000, usd: 100 },
      hadSaleInPriorPeriod: false,
      hadSaleInCurrentPeriod: true,
      recoverySale: null,
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    expect(result.nuevos).toHaveLength(0);
  });

  test('classifies an entity as recovered when it had a prior sale, no sale last period, and a sale this period from this seller', () => {
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 3,
      legalEntityName: 'Cliente C',
      firstSaleDateEver: '2024-01-01', // long-ago first sale, not "new"
      firstSaleSellerMatches: false,
      firstSaleAmount: { bs: 0, usd: 0 },
      hadSaleInPriorPeriod: false,
      hadSaleInCurrentPeriod: true,
      recoverySale: { lastSaleBeforeGap: '2025-11-01', gapDays: 300, recoverySaleDate: '2026-09-10', recoverySaleAmount: { bs: 500, usd: 50 } },
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    expect(result.recuperados).toHaveLength(1);
    expect(result.recuperados[0].legalEntityKey).toBe(3);
    expect(result.nuevos).toHaveLength(0);
  });

  test('an entity is never classified as both new and recovered', () => {
    // A synthetic entity that (incorrectly, if the caller had a bug) supplied
    // both a first-sale-in-period flag AND a recoverySale — classification
    // must prefer "new" and never emit the same entity in both lists, since
    // "new" is defined as zero prior sales ever, which makes a recovery
    // conceptually impossible for the same entity.
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 4,
      legalEntityName: 'Cliente D',
      firstSaleDateEver: '2026-09-15',
      firstSaleSellerMatches: true,
      firstSaleAmount: { bs: 1000, usd: 100 },
      hadSaleInPriorPeriod: false,
      hadSaleInCurrentPeriod: true,
      recoverySale: { lastSaleBeforeGap: '2025-01-01', gapDays: 600, recoverySaleDate: '2026-09-10', recoverySaleAmount: { bs: 200, usd: 20 } },
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    const inBoth = result.nuevos.some(n => n.legalEntityKey === 4) && result.recuperados.some(r => r.legalEntityKey === 4);
    expect(inBoth).toBe(false);
  });

  test('excludes an entity with no first-sale-in-period and no recovery sale', () => {
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 5,
      legalEntityName: 'Cliente E',
      firstSaleDateEver: '2020-01-01',
      firstSaleSellerMatches: false,
      firstSaleAmount: { bs: 0, usd: 0 },
      hadSaleInPriorPeriod: true,
      hadSaleInCurrentPeriod: true,
      recoverySale: null,
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    expect(result.nuevos).toHaveLength(0);
    expect(result.recuperados).toHaveLength(0);
  });

  // Regression test for the recovery-gap bug found during Task 7 live-DWH
  // verification: recoveryGapQuery originally bounded LastSaleBeforeGap by
  // "before the first current-period sale from this seller" instead of
  // "before priorStart" (the start of the immediately preceding comparison
  // period). That let a same-period seller handoff — Vendedor B sells to an
  // entity on day 1 of the current period, then Vendedor A (this profile's
  // seller) sells to the same entity a few days later, still inside the
  // SAME current period — masquerade as a "recovery" with a tiny gapDays
  // (1, 4, 7 were observed live), even though the entity never actually
  // churned: it had no gap at all, let alone one spanning the prior
  // comparison period. The fix makes the route only ever produce a
  // recoverySale object when the entity's last sale genuinely falls before
  // priorStart AND it had zero sales throughout [priorStart, priorEnd]
  // (hadSaleInPriorPeriod === false, computed independently) — this test
  // documents the corrected caller contract at the pure-function boundary:
  // once the route passes hadSaleInPriorPeriod: true (because the "prior"
  // sale actually happened inside the current period's own lookback, not a
  // real gap) and recoverySale: null (because the fixed recoveryGapQuery
  // correctly finds no sale before priorStart, or the entity is excluded
  // for having a prior-period sale it truly does have), classifyCustomers
  // must never invent a recuperado from a null recoverySale, and must not
  // classify as "new" either since this entity's first-ever sale was long
  // before the current period.
  test('does not classify a same-period seller handoff as recovered (no genuine gap before the prior comparison period)', () => {
    const entities: EntitySaleHistory[] = [{
      legalEntityKey: 6,
      legalEntityName: 'Cliente F',
      firstSaleDateEver: '2023-05-01', // long-ago genuine first sale — not "new"
      firstSaleSellerMatches: false,
      firstSaleAmount: { bs: 0, usd: 0 },
      // The entity DID have activity inside the immediately preceding
      // comparison period in the real-world scenario this guards against —
      // a seller handoff a few days before the current period's sale to
      // THIS seller means the entity was never actually dormant. Modeled
      // here as hadSaleInPriorPeriod: true (the corrected route computes
      // this independently via priorFlagMap, matching tab-clientes.tsx's
      // churn definition) with recoverySale: null (the corrected
      // recoveryGapQuery never runs for entities with hadSaleInPriorPeriod
      // === true, and even if it did, would find no sale before priorStart
      // that qualifies as a real gap).
      hadSaleInPriorPeriod: true,
      hadSaleInCurrentPeriod: true,
      recoverySale: null,
    }];
    const result = classifyCustomers(entities, '2026-09-01', '2026-09-30');
    expect(result.nuevos).toHaveLength(0);
    expect(result.recuperados).toHaveLength(0);
    expect(result.recuperados.some(r => r.legalEntityKey === 6)).toBe(false);
  });
});
