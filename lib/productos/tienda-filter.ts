/** Productos tab store filter: a whole legal entity (casa matriz) or a single store. */
export type TiendaFilter =
  | { kind: 'entidad'; key: number }
  | { kind: 'tienda'; code: string };

/** Accepts `e:<LegalEntityKey>`, `t:<CustomerCode>` or a bare customer code. */
export function parseTienda(param: string | null): TiendaFilter | null {
  if (param === null) return null;
  const v = param.trim();
  if (v === '') return null;
  if (v.startsWith('e:')) {
    const raw = v.slice(2);
    if (!/^\d+$/.test(raw)) return null;
    const key = Number(raw);
    // LegalEntityKey is an int32 column: out-of-range values would make mssql throw.
    if (!Number.isSafeInteger(key) || key > 2147483647) return null;
    return { kind: 'entidad', key };
  }
  if (v.startsWith('t:')) {
    const code = v.slice(2).trim();
    return code === '' ? null : { kind: 'tienda', code };
  }
  return { kind: 'tienda', code: v };
}

/**
 * Subquery of CustomerKeys. The entity case resolves membership by CURRENT rows,
 * then matches every SCD version of those customer codes.
 */
export function tiendaKeysSql(f: TiendaFilter): string {
  if (f.kind === 'tienda') {
    return 'SELECT tk.CustomerKey FROM dim.Dim_Customer tk WHERE tk.CustomerCode = @tiendaCode';
  }
  return `SELECT tk.CustomerKey FROM dim.Dim_Customer tk WHERE tk.CustomerCode IN (SELECT cur.CustomerCode FROM dim.Dim_Customer cur WHERE cur.IsCurrent = 1 AND cur.LegalEntityKey = @entidadKey)`;
}

export function bindTienda(
  req: { input(name: string, value: unknown): unknown },
  f: TiendaFilter | null,
): void {
  if (f === null) return;
  if (f.kind === 'entidad') req.input('entidadKey', f.key);
  else req.input('tiendaCode', f.code);
}

export function isSingleStore(f: TiendaFilter | null): boolean {
  return f !== null && f.kind === 'tienda';
}
