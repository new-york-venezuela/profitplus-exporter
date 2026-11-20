import { describe, expect, test } from 'bun:test';
import { buildGrupoTrend, OTRAS_CODE, type GrupoTrendRecord } from '../grupo-trend';

const rec = (bucketKey: string, groupCode: string | null, bs: number, usd: number | null, groupName: string | null = groupCode): GrupoTrendRecord =>
  ({ bucketKey, groupCode, groupName, bs, usd });

describe('buildGrupoTrend', () => {
  const records = [
    rec('2026-09', 'S1', 100, 10, 'Abasto'), rec('2026-10', 'S1', 200, 20, 'Abasto'),
    rec('2026-09', 'S2', 500, 50, 'Restaurante'), rec('2026-10', 'S2', 400, 40, 'Restaurante'),
    rec('2026-10', null, 30, 3, null),
  ];

  test('series are ordered by total Bs descending, with a name for each', () => {
    const t = buildGrupoTrend(records);
    expect(t.series).toEqual([
      { code: 'S2', name: 'Restaurante' }, { code: 'S1', name: 'Abasto' }, { code: '', name: 'Sin grupo' },
    ]);
  });

  test('buckets are sorted and carry sales per series (missing = 0)', () => {
    const t = buildGrupoTrend(records);
    expect(t.rows.map(r => r.bucketKey)).toEqual(['2026-09', '2026-10']);
    expect(t.rows[0].sales.S1).toEqual({ bs: 100, usd: 10 });
    expect(t.rows[0].sales['']).toEqual({ bs: 0, usd: 0 });
  });

  test('beyond the cap the smallest groups collapse into Otras (last), summing Bs and USD', () => {
    const many = Array.from({ length: 12 }, (_, i) => rec('2026-10', `G${i}`, 1000 - i * 10, 100 - i));
    const t = buildGrupoTrend(many, 10);
    expect(t.series).toHaveLength(11);
    expect(t.series[10]).toEqual({ code: OTRAS_CODE, name: 'Otras' });
    expect(t.rows[0].sales[OTRAS_CODE]).toEqual({ bs: 900 + 890, usd: 90 + 89 });
  });

  test('a null USD makes the Otras USD null, never a partial sum', () => {
    const many = [rec('2026-10', 'A', 10, 1), rec('2026-10', 'B', 5, null), rec('2026-10', 'C', 4, 1)];
    const t = buildGrupoTrend(many, 1);
    expect(t.rows[0].sales[OTRAS_CODE]).toEqual({ bs: 9, usd: null });
  });

  test('no records give no series and no rows', () => {
    expect(buildGrupoTrend([])).toEqual({ series: [], rows: [] });
  });
});
