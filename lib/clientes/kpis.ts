import type { ClientesParams } from '@/app/(app)/analitica/lib/clientes-params';
import { moneyLabel } from '@/app/(app)/analitica/lib/format';
import { newCustomersFunnel, patrimonioHolding } from '@/app/(app)/analitica/lib/kind-kpis';
import type { CoberturaResponse, Currency, DualAmount } from '@/app/(app)/analitica/types';
import type { EstadosResult } from './estados';
import type { TrayectoriaRow } from './trayectoria';

// Window the figure is measured over: the selected range ('período'), rolling 12 months to the range end ('12m'),
// all history ('histórico') or as of today ('hoy').
export type WindowTag = 'período' | '12m' | 'histórico' | 'hoy';

export interface KpiCardData {
  id: 'ventas' | 'activos' | 'patrimonio' | 'nuevos' | 'perdidos';
  label: string;
  value: string;
  current: number | null;   // numeric figure the delta is computed from; null = unknown
  previous: number | null;  // same figure for the previous equal period; null = no base
  windowTag: WindowTag;
  basis: string;            // what population / basis the figure covers
  hint?: string;
  warn?: boolean;
  onClickFilter?: Partial<ClientesParams>;
}

const NO_VALUE = '—';

// A USD or Bs total over chain rows: one unknown part makes the total unknown (never a partial sum).
function total(rows: readonly TrayectoriaRow[], pick: (r: TrayectoriaRow) => DualAmount | null, currency: Currency): number | null {
  let sum = 0;
  for (const r of rows) {
    const a = pick(r);
    const v = a === null ? null : currency === 'usd' ? a.usd : a.bs;
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

export function buildKpis(input: {
  cobertura: CoberturaResponse | null;
  estados: EstadosResult | null;
  trayectoria: readonly TrayectoriaRow[] | null;
  currency: Currency;
}): KpiCardData[] {
  const { cobertura, estados, trayectoria, currency } = input;
  const prevAvailable = cobertura?.prevPeriodAvailable === true;
  const rows = cobertura?.rows ?? [];

  const chains = trayectoria?.filter(r => r.kind === 'entidad') ?? null;
  const salesNow = chains ? total(chains, r => r.sales, currency) : null;
  const salesPrev = chains && prevAvailable ? total(chains, r => r.salesPrev, currency) : null;
  const money = (n: number | null) => (n === null ? NO_VALUE : moneyLabel(currency === 'usd' ? { bs: 0, usd: n } : { bs: n, usd: 0 }, currency));

  const activos = cobertura ? rows.filter(r => r.activeInPeriod === true).length : null;
  const activosPrev = cobertura && prevAvailable ? rows.filter(r => r.boughtPrev === true).length : null;

  const holding = cobertura ? patrimonioHolding(rows, prevAvailable, currency) : null;
  const funnel = cobertura ? newCustomersFunnel(rows) : null;
  const bridge = estados && estados.available ? estados.bridge : null;
  const lostNow = bridge ? bridge.enfriados + bridge.perdidos : null;

  return [
    {
      id: 'ventas', label: 'Ventas', value: money(salesNow), current: salesNow, previous: salesPrev, windowTag: 'período',
      basis: 'Ventas brutas sin IVA · incluye consignación',
    },
    {
      id: 'activos', label: 'Clientes activos', value: activos === null ? NO_VALUE : String(activos), current: activos, previous: activosPrev,
      windowTag: 'período', basis: 'Códigos de cliente con compras en el período',
    },
    {
      id: 'patrimonio', label: 'Patrimonio retenido',
      value: holding?.retainedPct == null ? NO_VALUE : `${(holding.retainedPct * 100).toFixed(1)}%`,
      current: holding?.retainedPct ?? null, previous: null, windowTag: 'período',
      basis: 'Patrimonio que compró en el período anterior y sigue comprando',
      hint: holding?.boughtPrev != null && holding.cooled != null ? `${holding.boughtPrev - holding.cooled} de ${holding.boughtPrev} siguen comprando` : 'Sin período anterior comparable',
      onClickFilter: { origen: 'patrimonio' },
    },
    {
      id: 'nuevos', label: 'Nuevos que se quedan',
      value: funnel ? `${funnel.constante} de ${funnel.registered}` : NO_VALUE,
      current: funnel && funnel.registered > 0 ? funnel.constante / funnel.registered : null, previous: null, windowTag: 'hoy',
      basis: 'Nuevos del año con compra en las últimas 3 visitas',
      hint: funnel ? `${funnel.neverBought} nunca compraron` : undefined,
      onClickFilter: { origen: 'nuevo' },
    },
    {
      id: 'perdidos', label: 'Perdidos y enfriados', value: lostNow === null ? NO_VALUE : String(lostNow), current: lostNow, previous: null,
      windowTag: 'período', basis: 'Compraron en el período anterior y no en este',
      hint: bridge ? `${bridge.enfriados} enfriados · ${bridge.perdidos} perdidos` : 'Sin período anterior comparable',
      warn: lostNow !== null && lostNow > 0,
    },
  ];
}
