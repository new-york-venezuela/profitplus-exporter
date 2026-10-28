import { describe, test, expect } from 'bun:test';
import { parsePromotionsCsv } from '@/lib/pricing/promo-import/csv';
import { buildPromoPlan } from '@/lib/pricing/promo-import/plan';

const HEAD = 'promocion,lista,desde,hasta,motivo,co_art,precio\n';
const ctx = {
  existing: [{ coPrecio: '09', desPrecio: 'Cadenas USD' }],
  pending: [{ key: 'A', nombre: 'Mayorista USD', desde: '2026-11-01', prices: new Map([['ART-1', 12.4]]) }],
  articles: [{ coArt: 'ART-1', artDes: 'Harina' }, { coArt: 'ART-2', artDes: 'Arroz' }],
  today: '2026-10-28',
};

describe('parsePromotionsCsv', () => {
  test('groups rows by promotion and takes the reason from any row', () => {
    const r = parsePromotionsCsv(`${HEAD}P1,A,2026-11-05,2026-11-20,,ART-1,10.9\nP1,A,2026-11-05,2026-11-20,Aniversario,ART-2,7.5\n`);
    expect(r.errors).toEqual([]);
    expect(r.promos.length).toBe(1);
    expect(r.promos[0].reason).toBe('Aniversario');
    expect(r.promos[0].items.map(i => i.coArt)).toEqual(['ART-1', 'ART-2']);
  });
  test('rejects inconsistent rows, reversed dates, repeated articles and bad prices', () => {
    const r = parsePromotionsCsv(
      `${HEAD}P1,A,2026-11-05,2026-11-20,,ART-1,10\nP1,B,2026-11-05,2026-11-20,,ART-2,10\nP2,A,2026-11-20,2026-11-05,,ART-1,10\nP1,A,2026-11-05,2026-11-20,,ART-1,9\nP3,A,2026-11-05,2026-11-20,,ART-1,"9,5"\n`,
    );
    expect(r.errors.length).toBe(4);
  });
});

describe('buildPromoPlan', () => {
  const plan = (csv: string) => buildPromoPlan(parsePromotionsCsv(HEAD + csv).promos, ctx);

  test('resolves a list by lists.csv key, by code or by name', () => {
    const p = plan('P1,A,2026-11-05,2026-11-20,,ART-1,10\nP2,09,2026-11-05,2026-11-20,,ART-1,10\nP3,cadenas usd,2026-12-05,2026-12-20,,ART-1,10\n');
    expect(p.problems).toEqual([]);
    expect(p.promos.map(x => x.target.kind)).toEqual(['pending', 'existing', 'existing']);
  });
  test('a lists.csv key that already exists in Profit by name resolves to the existing list', () => {
    const p = buildPromoPlan(parsePromotionsCsv(HEAD + 'P1,A,2026-11-05,2026-11-20,,ART-1,10\n').promos,
      { ...ctx, existing: [{ coPrecio: '10', desPrecio: 'mayorista usd' }] });
    expect(p.promos[0].target).toEqual({ kind: 'existing', coPrecio: '10', desPrecio: 'mayorista usd' });
  });
  test('problems: unknown list/article, past start, start before the regular price, missing regular, overlap', () => {
    const p = plan([
      'P1,ZZZ,2026-11-05,2026-11-20,,ART-1,10',
      'P2,A,2026-11-05,2026-11-20,,NOPE,10',
      'P3,A,2026-10-01,2026-11-20,,ART-1,10',
      'P4,A,2026-11-05,2026-11-20,,ART-2,10',
      'P5,A,2026-11-10,2026-11-25,,ART-1,10',
      'P6,A,2026-11-15,2026-11-30,,ART-1,10',
    ].join('\n') + '\n');
    const text = p.problems.join('\n');
    expect(text).toContain('«ZZZ»');
    expect(text).toContain('NOPE');
    expect(text).toContain('anterior a hoy');
    expect(text).toContain('antes de que la lista');
    expect(text).toContain('no tiene precio regular');
    expect(text).toContain('se solapan');
  });
  test('warns, without failing, when the promo price is not below the regular one', () => {
    const p = plan('P1,A,2026-11-05,2026-11-20,,ART-1,12.4\n');
    expect(p.problems).toEqual([]);
    expect(p.warnings.length).toBe(1);
  });
});
