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
});
