// Single source of truth for the Analítica tab list. analitica-client.tsx maps each key to its component
// (Record<TabKey, ...>, so the compiler enforces the two stay in sync). Retired tabs are simply absent:
// any old ?tab= value resolves to the default tab.
export const TAB_KEYS = [
  'resumen',
  'seguimiento',
  'ventas',
  'devoluciones',
  'cxc',
  'clientes',
  'productos',
  'matriz-vendedor',
  'cadencia',
  'historico',
  'finanzas',
  'multimoneda',
  'compras',
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export const DEFAULT_TAB: TabKey = 'resumen';

export const TAB_LABELS: Record<TabKey, string> = {
  resumen: 'Resumen',
  seguimiento: 'Seguimiento',
  ventas: 'Ventas',
  devoluciones: 'Devoluciones',
  cxc: 'CXC y Cobranzas',
  clientes: 'Clientes',
  productos: 'Productos',
  'matriz-vendedor': 'Matriz Vendedor-Producto',
  cadencia: 'Cadencia',
  historico: 'Histórico 2025',
  finanzas: 'Finanzas',
  multimoneda: 'Multimoneda',
  compras: 'Compras',
};

const KEY_SET: ReadonlySet<string> = new Set(TAB_KEYS);

export function resolveActiveTab(param: string | null | undefined): TabKey {
  return param && KEY_SET.has(param) ? (param as TabKey) : DEFAULT_TAB;
}
