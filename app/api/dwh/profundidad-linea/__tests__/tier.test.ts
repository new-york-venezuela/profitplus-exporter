import { describe, test, expect } from 'bun:test';
import { classifyTier, DEFAULT_TIER_THRESHOLDS } from '../tier';

describe('classifyTier', () => {
  test('no sales in range classifies as sin-ventas regardless of penetration', () => {
    expect(classifyTier(0, false, DEFAULT_TIER_THRESHOLDS)).toBe('sin-ventas');
    expect(classifyTier(null, false, DEFAULT_TIER_THRESHOLDS)).toBe('sin-ventas');
  });

  test('penetration at or above the first-line threshold classifies as primera', () => {
    expect(classifyTier(0.7, true, DEFAULT_TIER_THRESHOLDS)).toBe('primera');
    expect(classifyTier(0.95, true, DEFAULT_TIER_THRESHOLDS)).toBe('primera');
  });

  test('penetration at or above the second-line threshold but below first-line classifies as segunda', () => {
    expect(classifyTier(0.3, true, DEFAULT_TIER_THRESHOLDS)).toBe('segunda');
    expect(classifyTier(0.69, true, DEFAULT_TIER_THRESHOLDS)).toBe('segunda');
  });

  test('penetration below the second-line threshold but with sales classifies as addon', () => {
    expect(classifyTier(0.01, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
    expect(classifyTier(0, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
  });

  test('null penetration with sales (zero active entities in denominator) classifies as addon', () => {
    expect(classifyTier(null, true, DEFAULT_TIER_THRESHOLDS)).toBe('addon');
  });

  test('custom thresholds are respected', () => {
    const custom = { firstLineMinPenetration: 0.5, secondLineMinPenetration: 0.1 };
    expect(classifyTier(0.5, true, custom)).toBe('primera');
    expect(classifyTier(0.2, true, custom)).toBe('segunda');
    expect(classifyTier(0.05, true, custom)).toBe('addon');
  });
});
