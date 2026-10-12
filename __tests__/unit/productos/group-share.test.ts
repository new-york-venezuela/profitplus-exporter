import { describe, test, expect } from 'bun:test';
import { NO_GROUP_CODE, buildGroupShareMatrix, type GroupShareRaw } from '../../../lib/productos/group-share';

const raw = (label: string, groupCode: string | null, groupName: string | null, salesBs: number, salesUsd: number | null): GroupShareRaw =>
  ({ label, groupCode, groupName, salesBs, salesUsd });

describe('buildGroupShareMatrix', () => {
  const data = [
    raw('Panaderia', 'S1', 'Abasto', 3500, 70),
    raw('Panaderia', 'S2', 'Restaurante', 400, 8),
    raw('Panaderia', null, null, 300, null),
    raw('Pizza', 'S2', 'Restaurante', 700, 14),
    raw('Pizza', 'S1', 'Abasto', -50, -1),      // credit: ignored
    raw('Navidad', 'S1', 'Abasto', 0, 0),        // zero: ignored, the row disappears
  ];
  test('rows by total desc, shares by Bs sum to 1, absent pairs are absent', () => {
    const m = buildGroupShareMatrix(data);
    expect(m.rows.map(r => r.label)).toEqual(['Panaderia', 'Pizza']);
    const pan = m.rows[0];
    expect(pan.totalBs).toBe(4200);
    expect(pan.cells.S1.share).toBeCloseTo(3500 / 4200, 10);
    const sum = Object.values(pan.cells).reduce((s, c) => s + c.share, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(Object.keys(m.rows[1].cells)).toEqual(['S2']);
    expect(m.rows[1].cells.S2.share).toBe(1);
  });
  test('USD sums ignore null rows and stay null only when every contributing row is null', () => {
    const m = buildGroupShareMatrix(data);
    expect(m.rows[0].totalUsd).toBe(78);
    expect(m.rows[0].cells[NO_GROUP_CODE].salesUsd).toBeNull();
    expect(m.rows[0].cells.S1.salesUsd).toBe(70);
  });
  test('columns: by sales desc, "Sin grupo" always last even when it is the biggest', () => {
    const big = buildGroupShareMatrix([raw('A', null, null, 9000, null), raw('A', 'S1', 'Abasto', 10, 1), raw('A', 'S2', 'Restaurante', 20, 2)]);
    expect(big.columns.map(c => c.name)).toEqual(['Restaurante', 'Abasto', 'Sin grupo']);
  });
  test('maxRows keeps the biggest rows and drops columns only used by dropped rows', () => {
    const m = buildGroupShareMatrix([raw('A', 'S1', 'Abasto', 100, 2), raw('B', 'S2', 'Restaurante', 50, 1)], 1);
    expect(m.rows.map(r => r.label)).toEqual(['A']);
    expect(m.columns.map(c => c.code)).toEqual(['S1']);
  });
  test('a blank group code is treated as no group; duplicate (label, group) rows are merged', () => {
    const m = buildGroupShareMatrix([raw('A', '  ', '  ', 10, null), raw('A', null, null, 5, null)]);
    expect(m.rows[0].cells[NO_GROUP_CODE].salesBs).toBe(15);
  });
  test('nothing positive gives an empty matrix', () => {
    expect(buildGroupShareMatrix([])).toEqual({ columns: [], rows: [] });
    expect(buildGroupShareMatrix([raw('A', 'S1', 'Abasto', -1, null)])).toEqual({ columns: [], rows: [] });
  });
});
