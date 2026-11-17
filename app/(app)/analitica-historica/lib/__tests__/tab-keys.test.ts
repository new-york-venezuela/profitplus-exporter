import { describe, expect, test } from 'bun:test';
import { DEFAULT_HIST_TAB, HIST_TAB_KEYS, HIST_TAB_LABELS, resolveHistTab, HIST_RETURNS_BASIS_TABS } from '../tab-keys';

describe('resolveHistTab', () => {
  test('known keys pass through', () => {
    for (const k of HIST_TAB_KEYS) expect(resolveHistTab(k)).toBe(k);
  });

  test('unknown, retired and missing values open Resumen', () => {
    expect(resolveHistTab('historico')).toBe('resumen');
    expect(resolveHistTab('cxc')).toBe('resumen');
    expect(resolveHistTab(null)).toBe(DEFAULT_HIST_TAB);
    expect(resolveHistTab('')).toBe('resumen');
  });

  test('every tab has a label and the key order is the spec order', () => {
    expect([...HIST_TAB_KEYS]).toEqual(['resumen', 'ventas', 'devoluciones', 'clientes', 'productos', 'vendedores']);
    for (const k of HIST_TAB_KEYS) expect(HIST_TAB_LABELS[k].length).toBeGreaterThan(0);
  });

  test('the returns-basis selector applies to resumen, ventas and devoluciones only', () => {
    expect([...HIST_RETURNS_BASIS_TABS].sort()).toEqual(['devoluciones', 'resumen', 'ventas']);
  });
});
