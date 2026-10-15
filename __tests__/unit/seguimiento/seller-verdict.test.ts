import { describe, expect, test } from 'bun:test';
import {
  agingStatus, buildFindings, overdueStatus, ratioStatus, type VerdictInput,
} from '../../../lib/seguimiento/seller-verdict';

const base: VerdictInput = {
  attainment: null, projectedAttainment: null,
  weekPcts: [], overdue: 0, withInterval: 0,
  newCount: 0, newQuota: null,
};

describe('ratioStatus', () => {
  test.each([
    [null, 'none'], [0, 'bad'], [0.79, 'bad'], [0.8, 'warn'], [0.99, 'warn'], [1, 'good'], [1.5, 'good'],
  ] as const)('%p -> %s', (ratio, expected) => expect(ratioStatus(ratio)).toBe(expected));
});

describe('overdueStatus / agingStatus', () => {
  test('overdue share thresholds 10% / 30%', () => {
    expect(overdueStatus(0, 0)).toBe('none');
    expect(overdueStatus(0, 10)).toBe('good');
    expect(overdueStatus(1, 10)).toBe('warn');      // 10% is no longer good
    expect(overdueStatus(2, 10)).toBe('warn');
    expect(overdueStatus(3, 10)).toBe('bad');
  });
  test('past-due balance share thresholds 20% / 40%', () => {
    expect(agingStatus(null)).toBe('none');
    expect(agingStatus(0.19)).toBe('good');
    expect(agingStatus(0.2)).toBe('warn');
    expect(agingStatus(0.4)).toBe('bad');
  });
});

describe('buildFindings', () => {
  test('no goal and no problems -> no findings', () => {
    expect(buildFindings(base)).toEqual([]);
  });
  test('projection below 80% is red, 80-99% amber, >=100% green, worst first', () => {
    expect(buildFindings({ ...base, attainment: 0.4, projectedAttainment: 0.6 })[0]).toMatchObject({ severity: 'bad', text: 'Proyección al cierre al 60% de la meta (ventas al 40%)' });
    expect(buildFindings({ ...base, projectedAttainment: 0.9 })[0].severity).toBe('warn');
    expect(buildFindings({ ...base, projectedAttainment: 1.2 })[0].severity).toBe('good');
    const mixed = buildFindings({ ...base, projectedAttainment: 1.2, overdue: 4, withInterval: 10 });
    expect(mixed.map(f => f.severity)).toEqual(['bad', 'good']);
  });
  test('activation decline needs three consecutive falling weeks', () => {
    expect(buildFindings({ ...base, weekPcts: [0.8, 0.6, 0.4] }).map(f => f.text)).toContain('Activación bajó 2 semanas seguidas (de 80% a 40%)');
    expect(buildFindings({ ...base, weekPcts: [0.6, 0.4] })).toEqual([]);               // fewer than 3 weeks
    expect(buildFindings({ ...base, weekPcts: [0.5, 0.6, 0.4] })).toEqual([]);          // not consecutive
    expect(buildFindings({ ...base, weekPcts: [0.8, null, 0.4] })).toEqual([]);         // gap in data
  });
  test('behind on new customers only when a goal exists', () => {
    expect(buildFindings({ ...base, newCount: 0, newQuota: 2 }).map(f => f.text)).toContain('Nuevos clientes: 0 de 2');
    expect(buildFindings({ ...base, newCount: 2, newQuota: 2 })).toEqual([]);
    expect(buildFindings({ ...base, newCount: 0, newQuota: null })).toEqual([]);
  });
});
