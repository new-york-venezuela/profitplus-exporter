import { parseRuta } from '@/lib/clientes/scope';

/** Productos master-table filters: lines, sublines, customer group, route (customer's current row) and free text. */
export interface ItemFilter {
  lineas: string[];
  sublineas: string[];
  grupo: string | null;
  ruta: number | null;
  q: string | null;
}

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';
const MAX_LIST = 50;
const MAX_Q = 80;

function list(raw: string | null): string[] {
  if (raw === null) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .slice(0, MAX_LIST);
}

export function parseItemFilter(params: URLSearchParams): ItemFilter {
  const grupo = (params.get('grupo') ?? '').trim();
  const q = (params.get('q') ?? '').trim().slice(0, MAX_Q).trim();
  return {
    lineas: list(params.get('lineas')),
    sublineas: list(params.get('sublineas')),
    grupo: grupo === '' ? null : grupo,
    ruta: parseRuta(params.get('ruta')),
    q: q === '' ? null : q,
  };
}

function names(prefix: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `@${prefix}${i}`).join(', ');
}

function build(f: ItemFilter, p: string, fact: string): string {
  const parts: string[] = [];
  if (f.lineas.length > 0) {
    parts.push(`ISNULL(${p}.LineName, '${NO_LINEA}') IN (${names('linea', f.lineas.length)})`);
  }
  if (f.sublineas.length > 0) {
    parts.push(`ISNULL(${p}.SubLineName, '${NO_SUBLINEA}') IN (${names('sublinea', f.sublineas.length)})`);
  }
  if (f.grupo !== null) {
    parts.push(
      `${fact}.CustomerKey IN (SELECT tk.CustomerKey FROM dim.Dim_Customer tk JOIN dim.Dim_Customer cur ON cur.CustomerCode = tk.CustomerCode AND cur.IsCurrent = 1 WHERE RTRIM(cur.ErpSegmentCode) = @grupo)`,
    );
  }
  if (f.ruta !== null) {
    parts.push(
      `${fact}.CustomerKey IN (SELECT tk.CustomerKey FROM dim.Dim_Customer tk JOIN dim.Dim_Customer cur ON cur.CustomerCode = tk.CustomerCode AND cur.IsCurrent = 1 JOIN dim.Dim_Zone z ON z.ZoneCode = cur.ZoneCode WHERE z.RouteNumber = @ruta)`,
    );
  }
  if (f.q !== null) {
    parts.push(`(${p}.ProductCode LIKE @q ESCAPE '\\' OR ${p}.ProductName LIKE @q ESCAPE '\\')`);
  }
  return parts.map((s) => ` AND ${s}`).join('');
}

export function itemFilterSql(f: ItemFilter, o: { product?: string; fact?: string } = {}): string {
  return build(f, o.product ?? 'p', o.fact ?? 'fs');
}

export function returnsItemFilterSql(f: ItemFilter): string {
  return build(f, 'pr', 'fr');
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_[]/g, (c) => `\\${c}`);
}

export function bindItemFilter(
  req: { input(name: string, value: unknown): unknown },
  f: ItemFilter,
): void {
  f.lineas.forEach((v, i) => req.input(`linea${i}`, v));
  f.sublineas.forEach((v, i) => req.input(`sublinea${i}`, v));
  if (f.grupo !== null) req.input('grupo', f.grupo);
  if (f.ruta !== null) req.input('ruta', f.ruta);
  if (f.q !== null) req.input('q', `%${escapeLike(f.q)}%`);
}
