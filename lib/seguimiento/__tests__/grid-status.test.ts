import { describe, expect, test } from 'bun:test';
import { contrastRatio, gridStatus, STATUS_STYLES, type GridLevel } from '../grid-status';

describe('gridStatus', () => {
  test('ok at or above goal', () => {
    expect(gridStatus(1000, 1000)).toEqual({ level: 'ok', icon: '✓', label: 'En meta' });
    expect(gridStatus(1500, 1000).level).toBe('ok');
  });
  test('warn from 85%', () => {
    expect(gridStatus(850, 1000)).toEqual({ level: 'warn', icon: '!', label: 'Cerca' });
  });
  test('bad below 85%', () => {
    expect(gridStatus(849, 1000)).toEqual({ level: 'bad', icon: '✕', label: 'Bajo meta' });
    expect(gridStatus(0, 1000).level).toBe('bad');
  });
  test('none when goal or projection missing/invalid', () => {
    const none = { level: 'none', icon: '–', label: 'Sin meta' } as const;
    expect(gridStatus(500, null)).toEqual(none);
    expect(gridStatus(null, 1000)).toEqual(none);
    expect(gridStatus(500, 0)).toEqual(none);
    expect(gridStatus(500, -10)).toEqual(none);
    expect(gridStatus(NaN, 1000)).toEqual(none);
    expect(gridStatus(500, NaN)).toEqual(none);
  });
});

describe('contrastRatio', () => {
  test('black/white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });
  test('same colour is 1', () => {
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
  test('known grey pair #777 on white is about 4.48', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('STATUS_STYLES', () => {
  const levels: GridLevel[] = ['ok', 'warn', 'bad', 'none'];
  for (const level of levels) {
    for (const mode of ['light', 'dark'] as const) {
      test(`${level} ${mode} meets WCAG AA`, () => {
        const { fg, bg } = STATUS_STYLES[level][mode];
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
