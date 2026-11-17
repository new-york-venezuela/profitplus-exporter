export const HIST_TAB_KEYS = ['resumen', 'ventas', 'devoluciones', 'clientes', 'productos', 'vendedores'] as const;

export type HistTabKey = (typeof HIST_TAB_KEYS)[number];

export const DEFAULT_HIST_TAB: HistTabKey = 'resumen';

export const HIST_TAB_LABELS: Record<HistTabKey, string> = {
  resumen: 'Resumen',
  ventas: 'Ventas',
  devoluciones: 'Devoluciones',
  clientes: 'Clientes',
  productos: 'Productos',
  vendedores: 'Vendedores',
};

const KEY_SET: ReadonlySet<string> = new Set(HIST_TAB_KEYS);

export function resolveHistTab(param: string | null | undefined): HistTabKey {
  return param && KEY_SET.has(param) ? (param as HistTabKey) : DEFAULT_HIST_TAB;
}

/** Tabs whose figures depend on the returns basis; the toolbar selector shows only here. */
export const HIST_RETURNS_BASIS_TABS: ReadonlySet<HistTabKey> = new Set<HistTabKey>(['resumen', 'ventas', 'devoluciones']);

/** Tabs with a trend chart that honours the granularity selector. */
export const HIST_GRANULARITY_TABS: ReadonlySet<HistTabKey> = new Set<HistTabKey>(['resumen', 'ventas', 'vendedores']);
