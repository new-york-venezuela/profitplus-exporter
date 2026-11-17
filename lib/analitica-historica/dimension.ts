// Pure and import-free on purpose: client components use it, and sql.ts (which pulls in
// the mssql pool through query-builder) must never end up in the browser bundle.

/** How clients are listed: `entidad` = casa matriz roll-up (default), `tienda` = one row per customer. */
export type HistClienteDimension = 'entidad' | 'tienda';

export function parseClienteDimension(value: string | null): HistClienteDimension {
  return value === 'tienda' ? 'tienda' : 'entidad';
}
