import { describe, test, expect } from 'bun:test';
import { DEFAULT_TIER_THRESHOLDS, classifyTier } from '../../../lib/dwh/depth-tier';

describe('classifyTier', () => {
  test('no sales at all is sin-ventas regardless of penetration', () => {
    expect(classifyTier(0.9, false)).toBe('sin-ventas');
  });
  test('boundaries are inclusive: 70% is primera, 30% is segunda', () => {
    expect(classifyTier(0.7, true)).toBe('primera');
    expect(classifyTier(0.6999, true)).toBe('segunda');
    expect(classifyTier(0.3, true)).toBe('segunda');
    expect(classifyTier(0.2999, true)).toBe('addon');
  });
  test('null penetration with sales is addon, not a crash', () => {
    expect(classifyTier(null, true)).toBe('addon');
  });
  test('custom thresholds win over the defaults', () => {
    expect(classifyTier(0.5, true, { firstLineMinPenetration: 0.5, secondLineMinPenetration: 0.1 })).toBe('primera');
    expect(DEFAULT_TIER_THRESHOLDS).toEqual({ firstLineMinPenetration: 0.7, secondLineMinPenetration: 0.3 });
  });
});
