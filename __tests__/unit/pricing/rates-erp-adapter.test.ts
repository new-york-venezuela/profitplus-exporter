import { describe, test, expect } from 'bun:test';
import type { ConnectionPool } from 'mssql';
import { realRatesErp } from '@/lib/pricing/rates-erp-adapter';
import type { RatesErp } from '@/lib/pricing/lists-service';

const KEYS = [
  'listLists', 'getList', 'listCodes', 'listCurrencies', 'readListRates', 'readArticleRates',
  'dominantWarehouse', 'listArticles', 'getCustomerPriceList', 'applyRatePeriod', 'applyPlanned',
  'createList', 'updateList', 'cloneList',
] as const;

describe('realRatesErp', () => {
  const pool = {} as unknown as ConnectionPool;
  test('delegates every RatesErp method', () => {
    const erp: RatesErp = realRatesErp(pool);
    for (const k of KEYS) expect(typeof erp[k]).toBe('function');
    expect(Object.keys(erp).sort()).toEqual([...KEYS].sort());
  });
});
