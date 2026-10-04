import { describe, test, expect } from 'bun:test';
import { parseChildLevel, tiendasQuery, productosQuery } from '../ventas-children';

const f = {
  salesDateWhere: 'AND fs.DateKey >= 1', returnsDateWhere: 'AND fr.OriginalInvoiceDateKey >= 1',
  salesBucketWhere: '', returnsBucketWhere: '', salesRepWhere: '', returnsSalesRepWhere: '',
};

describe('parseChildLevel', () => {
  test('accepts only tienda and producto', () => {
    expect(parseChildLevel('tienda')).toBe('tienda');
    expect(parseChildLevel('producto')).toBe('producto');
    expect(parseChildLevel('x; DROP TABLE')).toBeNull();
    expect(parseChildLevel(null)).toBeNull();
  });
});

describe('child queries', () => {
  test('tiendas filters by entity key parameter and groups by trimmed code across versions', () => {
    const q = tiendasQuery(f);
    expect(q).toContain('@entityKey');
    expect(q).toContain('RTRIM(c.CustomerCode)');
    expect(q).toContain('IsCurrent = 1');
    expect(q).not.toContain('CustomerKey AS GroupValue');
  });
  test('productos filters by entity and store code parameters', () => {
    const q = productosQuery(f);
    expect(q).toContain('@entityKey');
    expect(q).toContain('@storeCode');
    expect(q).toContain('QuantitySold');
  });
});
