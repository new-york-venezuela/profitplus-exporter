import { describe, expect, test } from 'bun:test';
import { buildListCsv } from '@/lib/pricing/list-export';
import type { GridRow } from '@/lib/pricing/lists-service';

const row = (over: Partial<GridRow>): GridRow => ({
  coArt: 'A1', artDes: 'Harina', catDes: null, coAlma: '000015', ambiguous: false,
  current: { monto: 12.4, desde: '2026-01-01', hasta: null }, next: null, referenceMonto: 12.4, ...over,
});

describe('buildListCsv', () => {
  test('BOM, header and dot decimals', () => {
    const csv = buildListCsv([row({ next: { monto: 13.5, desde: '2026-12-01' } })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Código,Artículo,Precio vigente,Vigente desde,Próximo precio,Próximo desde');
    expect(lines[1]).toBe('A1,Harina,12.4,2026-01-01,13.5,2026-12-01');
  });

  test('rows with neither a current nor a next price are skipped', () => {
    const csv = buildListCsv([row({ current: null, next: null }), row({ coArt: 'B', current: null, next: { monto: 3, desde: '2026-12-01' } })]);
    expect(csv.slice(1).split('\r\n').length).toBe(2);
  });

  test('escapes commas and quotes; blanks for missing prices', () => {
    const csv = buildListCsv([row({ artDes: 'Arroz "Premium", 1kg', current: null, next: { monto: 1, desde: '2026-12-01' } })]);
    expect(csv.slice(1).split('\r\n')[1]).toBe('A1,"Arroz ""Premium"", 1kg",,,1,2026-12-01');
  });
});
