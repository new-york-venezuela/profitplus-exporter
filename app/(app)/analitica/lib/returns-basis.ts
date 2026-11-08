import type { ReturnsBasis } from '../types';
import type { TabKey } from './tab-keys';

export const DEFAULT_RETURNS_BASIS: ReturnsBasis = 'devolucion';

export function resolveReturnsBasis(param: string | null): ReturnsBasis {
  return param === 'factura' || param === 'devolucion' ? param : DEFAULT_RETURNS_BASIS;
}

/** Tabs whose figures depend on the returns basis; the toolbar selector shows only here. */
export const RETURNS_BASIS_TABS: ReadonlySet<TabKey> = new Set<TabKey>(['resumen', 'ventas', 'devoluciones']);
