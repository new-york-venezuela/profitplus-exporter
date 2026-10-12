// Group / route scope for the Clientes tab. Membership is decided by the CURRENT Dim_Customer row (by
// CustomerCode), so invoices issued under an older SCD2 version follow the customer. Values reach SQL only
// through .input(); the alias is the single interpolated token and is validated.
export interface CarteraScope { grupo: string | null; ruta: number | null }

const GRUPO_RE = /^[A-Za-z0-9_-]{1,6}$/;
const RUTA_RE = /^\d{1,3}$/;
const ALIAS_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export function parseCarteraScope(sp: URLSearchParams): CarteraScope {
  const g = (sp.get('grupo') ?? '').trim();
  const r = sp.get('ruta') ?? '';
  return { grupo: GRUPO_RE.test(g) ? g : null, ruta: RUTA_RE.test(r) ? Number(r) : null };
}

export interface CustomerScopeSql {
  where: string;
  bind(req: { input(name: string, value: unknown): unknown }): void;
}

export function customerScope(scope: CarteraScope, customerAlias: string = 'c'): CustomerScopeSql {
  if (!ALIAS_RE.test(customerAlias)) throw new Error(`Alias inválido '${customerAlias}'`);
  if (scope.grupo === null && scope.ruta === null) return { where: '', bind: () => {} };
  const conds = ['cur_s.IsCurrent = 1'];
  if (scope.grupo !== null) conds.push('RTRIM(cur_s.ErpSegmentCode) = @scopeGrupo');
  if (scope.ruta !== null) conds.push('z_s.RouteNumber = @scopeRuta');
  return {
    where: `AND ${customerAlias}.CustomerCode IN (SELECT cur_s.CustomerCode FROM dim.Dim_Customer cur_s LEFT JOIN dim.Dim_Zone z_s ON z_s.ZoneCode = cur_s.ZoneCode WHERE ${conds.join(' AND ')})`,
    bind: req => {
      if (scope.grupo !== null) req.input('scopeGrupo', scope.grupo);
      if (scope.ruta !== null) req.input('scopeRuta', scope.ruta);
    },
  };
}

export const CLIENTES_GROUPS_QUERY = `
  SELECT RTRIM(s.ErpSegmentCode) AS Code, s.SegmentName AS Name
  FROM dim.Dim_Segment s
  WHERE EXISTS (SELECT 1 FROM dim.Dim_Customer c
                WHERE c.IsCurrent = 1 AND c.IsInactive = 0 AND c.ErpSegmentCode = s.ErpSegmentCode)
  ORDER BY s.SegmentName
`;

export const CLIENTES_ROUTES_QUERY = `
  SELECT z.RouteNumber AS RouteNumber, z.ZoneName AS ZoneName
  FROM dim.Dim_Zone z
  WHERE z.IsRoute = 1 AND z.RouteNumber IS NOT NULL
    AND EXISTS (SELECT 1 FROM dim.Dim_Customer c
                WHERE c.IsCurrent = 1 AND c.IsInactive = 0 AND c.ZoneCode = z.ZoneCode)
  ORDER BY z.RouteNumber
`;
