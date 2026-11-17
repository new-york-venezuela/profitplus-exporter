import { describe, test, expect } from 'bun:test';
import { histKpiQueries, mapHistKpis } from './kpis';

const range = { startKey: 20250301, endKey: 20250331 };

describe('histKpiQueries customers', () => {
  const { customersSql } = histKpiQueries(range, 'devolucion');

  test('counts both clients (casa matriz) and stores', () => {
    for (const col of ['CustomersWithSales', 'CustomersWithReturns', 'CustomersNet', 'EntitiesWithSales', 'EntitiesWithReturns', 'EntitiesNet']) {
      expect(customersSql).toContain(`AS ${col}`);
    }
    expect(customersSql).toContain('ISNULL(c.LegalEntityLegacyKey, -c.CustomerLegacyKey)');
  });
});

describe('mapHistKpis', () => {
  test('maps the client (entity) and store counts separately', () => {
    const k = mapHistKpis(
      { SalesGrossBs: 10, SalesGrossUsd: 1, UnitsSold: 2 },
      { ReturnsBs: 0, ReturnsUsd: 0, UnitsReturned: 0 },
      { CustomersWithSales: 9, CustomersWithReturns: 3, CustomersNet: 8, EntitiesWithSales: 4, EntitiesWithReturns: 1, EntitiesNet: 4 },
    );
    expect(k).toMatchObject({
      customersWithSales: 9, customersWithReturns: 3, customersNet: 8,
      entitiesWithSales: 4, entitiesWithReturns: 1, entitiesNet: 4,
    });
  });

  test('missing counts are 0', () => {
    const k = mapHistKpis(undefined, undefined, undefined);
    expect(k.entitiesWithSales).toBe(0);
    expect(k.customersWithSales).toBe(0);
  });
});
