import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

export type CustomerSortKey = 'cliDes' | 'coZon' | 'coVen' | 'ultimoPedido';
const SORT_SQL: Record<CustomerSortKey, string> = {
  cliDes: 'c.cli_des',
  coZon: 'c.co_zon',
  coVen: 'c.co_ven',
  ultimoPedido: 'ult.ultimoPedido',
};

export interface CustomerFilters {
  search: string; tipCli: string; zona: string; vendedor: string;
  sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number; pageSize: number;
}

export interface CustomerDto {
  coCli: string; cliDes: string; coZon: string | null; zonDes: string | null;
  coVen: string | null; venDes: string | null; tipCli: string; ultimoPedido: string | null;
}

export function parseCustomerFilters(p: URLSearchParams): CustomerFilters {
  const sortRaw = p.get('sort') ?? '';
  const sort = (Object.keys(SORT_SQL) as CustomerSortKey[]).includes(sortRaw as CustomerSortKey) ? (sortRaw as CustomerSortKey) : 'cliDes';
  const dir = p.get('dir') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(parseInt(p.get('page') ?? '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(p.get('pageSize') ?? '50', 10) || 50, 1), 200);
  return {
    search: (p.get('search') ?? '').trim(), tipCli: (p.get('tipCli') ?? '').trim(),
    zona: (p.get('zona') ?? '').trim(), vendedor: (p.get('vendedor') ?? '').trim(),
    sort, dir, page, pageSize,
  };
}

export function buildCustomerQuery(f: CustomerFilters) {
  const conditions: string[] = [];
  const inputs: { name: string; type: 'VarChar'; length: number; value: string }[] = [];
  if (f.search) {
    inputs.push({ name: 'search', type: 'VarChar', length: 120, value: `%${f.search}%` });
    conditions.push(`(c.cli_des LIKE @search OR RTRIM(c.co_cli) LIKE @search OR c.rif LIKE @search)`);
  }
  if (f.tipCli) { inputs.push({ name: 'tipCli', type: 'VarChar', length: 6, value: f.tipCli }); conditions.push(`RTRIM(c.tip_cli) = RTRIM(@tipCli)`); }
  if (f.zona) { inputs.push({ name: 'zona', type: 'VarChar', length: 6, value: f.zona }); conditions.push(`RTRIM(c.co_zon) = RTRIM(@zona)`); }
  if (f.vendedor) { inputs.push({ name: 'vendedor', type: 'VarChar', length: 6, value: f.vendedor }); conditions.push(`RTRIM(c.co_ven) = RTRIM(@vendedor)`); }

  const dir = f.dir.toUpperCase();
  const orderBy = f.sort === 'ultimoPedido'
    ? `ORDER BY CASE WHEN ult.ultimoPedido IS NULL THEN 1 ELSE 0 END, ult.ultimoPedido ${dir}, c.cli_des ASC`
    : `ORDER BY ${SORT_SQL[f.sort]} ${dir}${f.sort === 'cliDes' ? '' : ', c.cli_des ASC'}`;

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    orderBy,
    offset: (f.page - 1) * f.pageSize,
    inputs,
  };
}

const FROM = `
  FROM saCliente c
  LEFT JOIN saZona z ON z.co_zon = c.co_zon
  LEFT JOIN saVendedor v ON v.co_ven = c.co_ven
  LEFT JOIN (SELECT co_cli, MAX(fec_emis) AS ultimoPedido FROM saFacturaVenta WHERE anulado = 0 GROUP BY co_cli) ult
         ON ult.co_cli = c.co_cli`;

export async function queryCustomers(pool: ConnectionPool, f: CustomerFilters) {
  const q = buildCustomerQuery(f);
  const bind = (req: sql.Request) => {
    for (const i of q.inputs) req.input(i.name, sql.VarChar(i.length), i.value);
    return req;
  };
  const count = await bind(pool.request()).query(`SELECT COUNT(*) AS total ${FROM} ${q.where}`);
  const rows = await bind(pool.request())
    .input('offset', sql.Int, q.offset)
    .input('pageSize', sql.Int, f.pageSize)
    .query(`
      SELECT RTRIM(c.co_cli) AS coCli, RTRIM(c.cli_des) AS cliDes,
             RTRIM(c.co_zon) AS coZon, RTRIM(z.zon_des) AS zonDes,
             RTRIM(c.co_ven) AS coVen, RTRIM(v.ven_des) AS venDes,
             RTRIM(c.tip_cli) AS tipCli,
             CONVERT(VARCHAR(10), ult.ultimoPedido, 23) AS ultimoPedido
      ${FROM} ${q.where} ${q.orderBy}
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return { customers: rows.recordset as CustomerDto[], total: count.recordset[0].total as number, page: f.page, pageSize: f.pageSize };
}

export async function listCustomerFilterOptions(pool: ConnectionPool) {
  const [z, v] = await Promise.all([
    pool.request().query(`SELECT RTRIM(co_zon) AS value, RTRIM(zon_des) AS label FROM saZona ORDER BY zon_des`),
    pool.request().query(`SELECT RTRIM(co_ven) AS value, RTRIM(ven_des) AS label FROM saVendedor WHERE inactivo = 0 ORDER BY ven_des`),
  ]);
  return {
    zonas: z.recordset as { value: string; label: string }[],
    vendedores: v.recordset as { value: string; label: string }[],
  };
}
