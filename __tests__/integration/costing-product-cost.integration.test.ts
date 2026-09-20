import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { computeProductCost, type RecipeLineInput } from '@/lib/costing/product-cost';
import { getCostLayers } from '@/lib/costing/erp-layers';
import { computeFifoCost } from '@/lib/costing/fifo';
import { getUsdRateAsOf, convertBsdToUsd } from '@/lib/costing/currency';

function buildMssqlConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

let pool: sql.ConnectionPool;

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();
});

afterAll(async () => {
  await pool.close();
});

describe('computeProductCost', () => {
  test('combines an erp_article line and a manual line into a USD total, matching an independently hand-computed expectation', async () => {
    const asOf = new Date();
    const quantity = 0.5;

    const lines: RecipeLineInput[] = [
      { lineType: 'erp_article', coArt: '0000083', quantity, manualUnitCostUsd: null },
      { lineType: 'manual', coArt: null, quantity: 1, manualUnitCostUsd: 0.10 },
    ];

    const result = await computeProductCost(pool, lines, asOf);

    // Hand-compute the expected erp_article line from the same primitives, independently of computeProductCost's internals.
    const layers = await getCostLayers(pool, '0000083');
    const fifo = computeFifoCost(layers, quantity);
    const rate = await getUsdRateAsOf(pool, asOf);
    const expectedErpLineUsd = convertBsdToUsd(fifo.costBsd, rate!.rate);

    const erpLine = result.lines.find(l => l.lineType === 'erp_article')!;
    expect(erpLine.costUsd).toBeCloseTo(expectedErpLineUsd, 5);
    expect(erpLine.estimated).toBe(fifo.estimated);

    const manualLine = result.lines.find(l => l.lineType === 'manual')!;
    expect(manualLine.costUsd).toBeCloseTo(0.10, 5);
    expect(manualLine.estimated).toBe(false);

    expect(result.totalUsd).toBeCloseTo(expectedErpLineUsd + 0.10, 5);
    expect(result.incomplete).toBe(false);
    expect(result.asOfRateDate).not.toBeNull();
  });

  test('an erp_article line with zero purchase history has null cost and marks the result incomplete', async () => {
    const lines: RecipeLineInput[] = [
      { lineType: 'erp_article', coArt: '0000080', quantity: 1, manualUnitCostUsd: null },
    ];

    const result = await computeProductCost(pool, lines, new Date());

    expect(result.lines[0]!.costUsd).toBeNull();
    expect(result.incomplete).toBe(true);
    expect(result.totalUsd).toBe(0);
  });

  test('a manual line with no manualUnitCostUsd set defaults to 0, not null', async () => {
    const lines: RecipeLineInput[] = [
      { lineType: 'manual', coArt: null, quantity: 5, manualUnitCostUsd: null },
    ];

    const result = await computeProductCost(pool, lines, new Date());

    expect(result.lines[0]!.costUsd).toBe(0);
    expect(result.incomplete).toBe(false);
  });
});
