import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseCreditTermsCsv } from '../../../lib/credit-terms/csv';

const { rows, errors } = parseCreditTermsCsv(readFileSync('data/credit-terms/2026-10.csv', 'utf8'));
const by = (prefix: string) => rows.filter(r => r.coCli === prefix || r.coCli.startsWith(`${prefix}-`));

describe('data/credit-terms/2026-10.csv', () => {
  test('is valid, complete and has nothing left to review', () => {
    expect(errors).toEqual([]);
    expect(rows.length).toBe(188);
    expect(rows.filter(r => r.source === 'review')).toEqual([]);
  });

  test('Unicasa parent and stores are 15 days, an override of Ops', () => {
    const unicasa = by('J001675523');
    expect(unicasa.length).toBe(10);
    for (const r of unicasa) expect([r.diasCred, r.source]).toEqual([15, 'override']);
  });

  test('Cold 2024, Páramo, Entren Que Caben Cien and Farma Servicios branches are 7 days', () => {
    for (const code of ['J505366220', 'J503848049', 'J504525057']) {
      expect(by(code).length).toBeGreaterThan(1);
      for (const r of by(code)) expect(r.diasCred).toBe(7);
    }
    const one = (code: string) => rows.find(r => r.coCli === code)!;
    expect(one('J-504108979').diasCred).toBe(7);
    expect(one('J502434526').diasCred).toBe(7);
  });

  test('Rio Vida is 35, Kalea 21, Daranpe 21 fuzzy', () => {
    for (const r of by('J500585039')) expect(r.diasCred).toBe(35);
    expect(rows.filter(r => /KALEA/i.test(r.nombre)).map(r => r.diasCred)).toEqual([21]);
    for (const code of ['J-306811036-1', 'J-306811036-2']) {
      const r = rows.find(x => x.coCli === code)!;
      expect([r.diasCred, r.source]).toEqual([21, 'fuzzy']);
    }
  });

  test('the customers left out on purpose are skipped', () => {
    for (const code of ['J-000797218-1', 'J300542033', 'J504101435', 'J505130587', 'J-008690480', 'J411057444', 'J508477782']) {
      const r = rows.find(x => x.coCli === code)!;
      expect([r.source, r.diasCred]).toEqual(['skip', null]);
    }
  });

  test('prod-only customers listed by Ops are exact 7; the two not in Ops are skipped', () => {
    for (const code of ['J502346473', 'J5055663682']) {
      const r = rows.find(x => x.coCli === code)!;
      expect([r.diasCred, r.source]).toEqual([7, 'exact']);
    }
  });
});
