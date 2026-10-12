import { describe, test, expect } from 'bun:test';
import { DEFAULT_TAB, TAB_KEYS, TAB_LABELS, resolveActiveTab } from '../tab-keys';

describe('tab registry', () => {
  test('resumen is the default and the first tab', () => {
    expect(DEFAULT_TAB).toBe('resumen');
    expect(TAB_KEYS[0]).toBe('resumen');
  });
  test('every key has a non-empty label and keys are unique', () => {
    expect(new Set(TAB_KEYS).size).toBe(TAB_KEYS.length);
    for (const k of TAB_KEYS) expect(TAB_LABELS[k].trim().length).toBeGreaterThan(0);
  });
  test('a known tab resolves to itself', () => {
    for (const k of TAB_KEYS) expect(resolveActiveTab(k)).toBe(k);
  });
  test('unknown, empty and missing values fall back to the default tab', () => {
    expect(resolveActiveTab('no-existe')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab('')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab(null)).toBe(DEFAULT_TAB);
    expect(resolveActiveTab(undefined)).toBe(DEFAULT_TAB);
  });
  test('lookup is exact: a prototype key or different case does not resolve', () => {
    expect(resolveActiveTab('constructor')).toBe(DEFAULT_TAB);
    expect(resolveActiveTab('Resumen')).toBe(DEFAULT_TAB);
  });
});

describe('retired tab: vendedores', () => {
  test('is no longer a tab and an old link opens the default tab', () => {
    expect(TAB_KEYS).not.toContain('vendedores' as never);
    expect(resolveActiveTab('vendedores')).toBe('resumen');
  });
});
