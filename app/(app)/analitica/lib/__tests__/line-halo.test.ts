import { describe, expect, test } from 'bun:test';
import { BAR_Z_INDEX, LINE_Z_INDEX, haloLineProps, trendLineProps, trendDot } from '../line-halo';

describe('line halo', () => {
  test('line sits above the bars and the halo between them', () => {
    const halo = haloLineProps();
    expect(LINE_Z_INDEX).toBeGreaterThan(BAR_Z_INDEX);
    expect(halo.zIndex).toBeGreaterThan(BAR_Z_INDEX);
    expect(halo.zIndex).toBeLessThan(LINE_Z_INDEX);
  });

  test('halo is a wider white solid line hidden from legend, tooltip and dots', () => {
    const halo = haloLineProps();
    const line = trendLineProps();
    expect(halo.stroke).toBe('#fff');
    expect(halo.strokeWidth).toBeGreaterThan(line.strokeWidth);
    expect(halo.strokeDasharray).toBeUndefined();
    expect(halo.dot).toBe(false);
    expect(halo.activeDot).toBe(false);
    expect(halo.legendType).toBe('none');
    expect(halo.tooltipType).toBe('none');
    expect(halo.connectNulls).toBe(false);
  });

  test('visible line keeps its dash and has readable markers', () => {
    const line = trendLineProps();
    expect(line.strokeDasharray).toBe('5 3');
    expect(line.zIndex).toBe(LINE_Z_INDEX);
    expect(line.connectNulls).toBe(false);
    expect(trendDot).toMatchObject({ r: 3.5, fill: '#111827', stroke: '#fff' });
  });
});
