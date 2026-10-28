import type { TipoClienteRow } from './csv';

export interface PlanSegment { tipCli: string; desTipo: string; coPrecio: string; special: boolean }
export interface PlanList { coPrecio: string; desPrecio: string; coMone: string | null; rateCount: number }
export interface PlanCustomer { coCli: string; cliDes: string; tipCli: string }
export interface PlanContext {
  /** Looked up from the ERP for every co_cli in the file; absent = unknown customer. */
  customers: Map<string, PlanCustomer>;
  segments: PlanSegment[];
  lists: PlanList[];
}

export interface PlannedMove {
  coCli: string; nombre: string; fromTipCli: string;
  /** Existing segment, or null when `createForList` will provide it. */
  toTipCli: string | null;
  createForList: string | null;
  coPrecio: string;
}
export interface TipoClientePlan {
  moves: PlannedMove[];
  /** Lists that need a new segment, in first-use order. */
  segmentsToCreate: { coPrecio: string; desTipo: string }[];
  unchanged: number;
  blank: number;
  problems: string[];
  warnings: string[];
}

const norm = (s: string) => s.trim().toUpperCase();
const MAX_NAME = 60;

type Resolved =
  | { ok: true; tipCli: string | null; coPrecio: string; create: boolean }
  | { ok: false; error: string };

/**
 * `tip_cli_nuevo` is an existing segment code or a price-list code. `L:09` forces the list reading; a bare value is a
 * segment code when one exists, else a list code. Using a list code picks that list's only ordinary segment, or creates one.
 */
function resolveTarget(raw: string, ctx: PlanContext, warnings: string[], at: string): Resolved {
  const forced = /^L:/i.test(raw);
  const value = forced ? raw.slice(2).trim() : raw;
  const seg = forced ? undefined : ctx.segments.find(s => norm(s.tipCli) === norm(value));
  const list = ctx.lists.find(l => norm(l.coPrecio) === norm(value));

  if (seg) {
    if (list && norm(seg.coPrecio) !== norm(list.coPrecio)) {
      warnings.push(`${at}: «${value}» es a la vez el segmento ${seg.tipCli} (lista ${seg.coPrecio}) y la lista ${list.coPrecio}; se usó el segmento. Escriba L:${list.coPrecio} para la lista`);
    }
    if (seg.special) return { ok: false, error: `${at}: el segmento ${seg.tipCli} es de una promoción o precio especial; no se asigna por aquí` };
    return { ok: true, tipCli: seg.tipCli, coPrecio: seg.coPrecio, create: false };
  }
  if (!list) return { ok: false, error: `${at}: «${raw}» no es un segmento ni una lista de precios existentes` };
  const candidates = ctx.segments.filter(s => !s.special && norm(s.coPrecio) === norm(list.coPrecio));
  if (candidates.length === 1) return { ok: true, tipCli: candidates[0].tipCli, coPrecio: list.coPrecio, create: false };
  if (candidates.length > 1) {
    return { ok: false, error: `${at}: la lista ${list.coPrecio} tiene varios segmentos (${candidates.map(c => c.tipCli).join(', ')}); escriba el código del segmento` };
  }
  return { ok: true, tipCli: null, coPrecio: list.coPrecio, create: true };
}

export function buildTipoClientePlan(rows: TipoClienteRow[], ctx: PlanContext): TipoClientePlan {
  const plan: TipoClientePlan = { moves: [], segmentsToCreate: [], unchanged: 0, blank: 0, problems: [], warnings: [] };
  const listWarned = new Set<string>();

  for (const row of rows) {
    if (!row.target) { plan.blank++; continue; }
    const at = `Línea ${row.line} (${row.coCli})`;
    const customer = ctx.customers.get(norm(row.coCli));
    if (!customer) { plan.problems.push(`${at}: cliente no encontrado en Profit`); continue; }
    const r = resolveTarget(row.target, ctx, plan.warnings, at);
    if (!r.ok) { plan.problems.push(r.error); continue; }

    const list = ctx.lists.find(l => norm(l.coPrecio) === norm(r.coPrecio))!;
    if (list.rateCount === 0) { plan.problems.push(`${at}: la lista ${list.coPrecio} «${list.desPrecio}» no tiene precios cargados`); continue; }
    if (row.moneda90d && list.coMone && row.moneda90d !== list.coMone && !listWarned.has(`${row.coCli}`)) {
      listWarned.add(row.coCli);
      plan.warnings.push(`${at}: facturó en ${row.moneda90d} y la lista ${list.coPrecio} está en ${list.coMone}`);
    }

    if (r.tipCli !== null && norm(r.tipCli) === norm(customer.tipCli)) { plan.unchanged++; continue; }
    if (r.create && !plan.segmentsToCreate.some(s => s.coPrecio === r.coPrecio)) {
      const desTipo = list.desPrecio.trim().slice(0, MAX_NAME);
      plan.segmentsToCreate.push({ coPrecio: r.coPrecio, desTipo });
    }
    plan.moves.push({
      coCli: customer.coCli, nombre: customer.cliDes, fromTipCli: customer.tipCli,
      toTipCli: r.tipCli, createForList: r.create ? r.coPrecio : null, coPrecio: r.coPrecio,
    });
  }
  return plan;
}
