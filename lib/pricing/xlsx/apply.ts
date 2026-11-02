import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { applyImport, type ListOutcome } from '@/lib/pricing/list-import/run';
import { applyPromoImport, planPromoImport } from '@/lib/pricing/promo-import/run';
import type { Actor } from '@/lib/pricing/segments-service';
import { applyTipoCliente, planTipoCliente } from '@/lib/pricing/tipo-cliente-apply/run';
import type { TipoClienteRow } from '@/lib/pricing/tipo-cliente-apply/csv';
import type { TipoClientePlan } from '@/lib/pricing/tipo-cliente-apply/plan';
import { NEW_LIST_SENTINEL, type ParsedWorkbook } from '@/lib/pricing/xlsx/parse-workbook';
import type { WorkbookDeps, WorkbookPlan } from '@/lib/pricing/xlsx/import';
import { applyDiscountSets, loadTypeContext, resolveCustomerType } from '@/lib/pricing/xlsx/discounts-run';

export type StepName = 'lists' | 'promotions' | 'customers' | 'discounts';
export type Step = StepName | 'all';
/** The three module deps (ListsDeps, PromotionsDeps, TipoClienteDeps) are all satisfied by rates + segments + db. */
export type WorkbookApplyDeps = WorkbookDeps & { today: string };

export interface StepOutcome {
  step: StepName;
  status: 'ok' | 'failed' | 'skipped';
  /** Human lines for the script to print, already in Spanish. */
  lines: string[];
  failures: number;
  /** customers step: how many customers were actually moved (the run file only exists when this is > 0). */
  moved?: number;
}

/** Discounts run last: a dated discount's special segment falls back to the type segment the customers step assigns. */
export const STEP_ORDER: StepName[] = ['lists', 'promotions', 'customers', 'discounts'];

const norm = (s: string) => s.trim().toUpperCase();

/** Replaces `L:@key` targets with `L:<coPrecio>`. Keys match trimmed and case-insensitively; an unknown key throws. */
export function resolveListSentinels(rows: TipoClienteRow[], created: { key: string; coPrecio: string }[]): TipoClienteRow[] {
  const byKey = new Map(created.map(c => [norm(c.key), c.coPrecio]));
  return rows.map(r => {
    if (!r.target.startsWith(NEW_LIST_SENTINEL)) return r;
    const key = r.target.slice(NEW_LIST_SENTINEL.length);
    const coPrecio = byKey.get(norm(key));
    if (!coPrecio) throw new Error(`Lista «${key}» no existe`);
    return { ...r, target: `L:${coPrecio}` };
  });
}

async function runLists(deps: WorkbookApplyDeps, plan: WorkbookPlan, actor: Actor): Promise<{ out: StepOutcome; done: ListOutcome[] }> {
  const done = await applyImport({ erp: deps.rates, db: deps.db }, plan.lists, actor);
  const lines: string[] = [];
  let failures = 0;
  for (const o of done) {
    const count = (k: string) => o.results.filter(r => r.outcome === k).length;
    const bad = o.results.filter(r => r.outcome !== 'success' && r.outcome !== 'skipped');
    lines.push(`${o.key} → lista ${o.coPrecio}${o.created ? ' (creada)' : ''}: ${count('success')} aplicados, ${count('skipped')} sin cambio, ${bad.length} con problema`);
    for (const r of bad) { failures++; lines.push(`  ✗ ${r.coArt}: ${r.outcome}${r.message ? ` — ${r.message}` : ''}`); }
  }
  if (!done.length) lines.push('Sin listas nuevas.');
  return { out: { step: 'lists', status: failures ? 'failed' : 'ok', lines, failures }, done };
}

async function runPromotions(deps: WorkbookApplyDeps, plan: WorkbookPlan, parsed: ParsedWorkbook, actor: Actor): Promise<StepOutcome> {
  let promos = plan.promos;
  const stillPending = () => promos.promos.filter(p => !p.alreadyExists && p.target.kind === 'pending');
  if (stillPending().length) {
    // Lists created earlier in this run now exist in Profit; plan again so promotions resolve to their real codes.
    const pending = parsed.lists.map(l => ({
      key: l.key, nombre: l.nombre, desde: l.desde,
      prices: new Map(parsed.cells.filter(c => c.key === l.key).map(c => [norm(c.coArt), c.monto])),
    }));
    promos = await planPromoImport(deps, parsed.promos, pending, deps.today);
    if (promos.problems.length) return { step: 'promotions', status: 'failed', lines: promos.problems.map(p => `  ✗ ${p}`), failures: promos.problems.length };
  }
  const notReady = stillPending();
  if (notReady.length) {
    return {
      step: 'promotions', status: 'failed', failures: notReady.length,
      lines: [`✗ Estas promociones apuntan a listas que aún no existen: ${notReady.map(p => `«${p.name}»`).join(', ')}. Ejecute antes --step lists.`],
    };
  }
  const lines: string[] = [];
  let failures = 0;
  for (const o of await applyPromoImport(deps, promos, actor)) {
    lines.push(`«${o.name}» (#${o.id}, ${o.status}): ${o.applied}/${o.items} artículos aplicados${o.warning ? ` — ⚠ ${o.warning}` : ''}`);
    for (const m of o.problems) { failures++; lines.push(`  ✗ ${m}`); }
    if (o.applied < o.items || o.warning) failures++;
  }
  if (!lines.length) lines.push('Sin promociones nuevas.');
  return { step: 'promotions', status: failures ? 'failed' : 'ok', lines, failures };
}

async function runCustomers(
  deps: WorkbookApplyDeps, parsed: ParsedWorkbook, actor: Actor, runFile: string, createdLists: ListOutcome[] | null,
): Promise<StepOutcome> {
  const fail = (lines: string[]): StepOutcome => ({ step: 'customers', status: 'failed', lines, failures: lines.length });
  const keys = [...new Set(parsed.customers.filter(c => c.target.startsWith(NEW_LIST_SENTINEL)).map(c => c.target.slice(NEW_LIST_SENTINEL.length)))];

  let created: { key: string; coPrecio: string }[] = (createdLists ?? []).map(o => ({ key: o.key, coPrecio: o.coPrecio }));
  if (keys.length && !createdLists) {
    // Keys are not persisted between runs: find each new list in Profit by its nombre.
    const live = await deps.rates.listLists();
    const missing: string[] = [];
    created = [];
    for (const key of keys) {
      const def = parsed.lists.find(l => norm(l.key) === norm(key));
      const hits = def ? live.filter(l => norm(l.desPrecio) === norm(def.nombre)) : [];
      if (hits.length > 1) {
        missing.push(`✗ Hay ${hits.length} listas en Profit llamadas «${def!.nombre}» (${hits.map(h => h.coPrecio).join(', ')}); no se sabe a cuál asignar los clientes. Deje una sola o use el código de lista en tip_cli_nuevo`);
        continue;
      }
      const hit = hits[0];
      if (hit) created.push({ key, coPrecio: hit.coPrecio });
      else missing.push(`✗ Lista «${def?.nombre ?? key}» no existe en Profit; ejecute antes --step lists`);
    }
    if (missing.length) return fail(missing);
  }

  let rows: TipoClienteRow[];
  try { rows = resolveListSentinels(parsed.customers, created); } catch (e) { return fail([`✗ ${e instanceof Error ? e.message : String(e)}`]); }

  const plan = await planTipoCliente(deps, rows);
  if (plan.problems.length) return fail(plan.problems.map(p => `✗ ${p}`));
  const keptOnDiscount = await dropMovesOffDiscount(deps, plan, parsed);

  mkdirSync(dirname(runFile), { recursive: true });
  const r = await applyTipoCliente(deps, plan, actor, runFile);
  const lines = r.createdSegments.map(s => `Segmento ${s.tipCli} creado para la lista ${s.coPrecio}`);
  if (keptOnDiscount) lines.push(`${keptOnDiscount} cliente(s) con descuento ya tienen ese tipo; siguen en su segmento de descuento`);
  const ok = r.moves.filter(m => m.outcome === 'success').length;
  lines.push(`Movidos: ${ok} de ${r.moves.length}`);
  const bad = r.moves.filter(m => m.outcome !== 'success');
  for (const m of bad) lines.push(`  ✗ ${m.coCli} ${m.nombre}: ${m.outcome}${m.message ? ` — ${m.message}` : ''}`);
  return { step: 'customers', status: bad.length ? 'failed' : 'ok', lines, failures: bad.length, moved: ok };
}

/**
 * A discounted customer whose discount segment (from an earlier run) already unwraps to the target type is not moved
 * back to the type segment: the discounts step would only move it onto the discount segment again. Returns how many.
 */
async function dropMovesOffDiscount(deps: WorkbookApplyDeps, plan: TipoClientePlan, parsed: ParsedWorkbook): Promise<number> {
  const discounted = new Set(parsed.discounts.map(d => norm(d.coCli)));
  if (!plan.moves.some(m => discounted.has(norm(m.coCli)))) return 0;
  const ctx = await loadTypeContext(deps);
  const before = plan.moves.length;
  const kept: TipoClientePlan['moves'] = [];
  for (const m of plan.moves) {
    const type = discounted.has(norm(m.coCli)) && m.toTipCli ? resolveCustomerType(ctx, m.fromTipCli) : null;
    if (type && norm(type.tipCli) === norm(m.toTipCli!) && norm(m.fromTipCli) !== norm(type.tipCli)) continue;
    kept.push(m);
  }
  plan.moves = kept;
  plan.unchanged += before - kept.length;
  return before - kept.length;
}

async function runDiscounts(deps: WorkbookApplyDeps, plan: WorkbookPlan, actor: Actor): Promise<StepOutcome> {
  if (!plan.discounts.sets.length) return { step: 'discounts', status: 'ok', lines: ['Sin descuentos por cliente.'], failures: 0 };
  // Resolved live, after the customers step: the customer's current segment, seen through any earlier discount segment.
  const ctx = await loadTypeContext(deps);
  const typeOf = async (coCli: string) => {
    const c = await deps.segments.getCustomer(coCli);
    return c ? resolveCustomerType(ctx, c.tipCli) : null;
  };
  const done = await applyDiscountSets(
    { lists: { erp: deps.rates, db: deps.db }, segments: { erp: deps.segments, db: deps.db } }, plan.discounts.sets, typeOf, actor,
  );
  const lines: string[] = [];
  let failures = 0;
  for (const o of done) {
    const ok = o.customers.filter(c => c.outcome === 'success').length;
    const where = o.coPrecio ? `lista especial ${o.coPrecio}${o.reusedList ? ' (ya existía)' : ' (creada)'}` : 'sin lista especial';
    lines.push(`${o.key} → ${where}: ${ok} de ${o.customers.length} clientes asignados`);
    for (const c of o.customers.filter(x => x.outcome !== 'success')) {
      failures++;
      lines.push(`  ✗ ${c.coCli}: ${c.outcome}${c.message ? ` — ${c.message}` : ''}`);
    }
  }
  return { step: 'discounts', status: failures ? 'failed' : 'ok', lines, failures };
}

/**
 * Applies the workbook in the fixed order lists → promotions → customers → discounts. `all` stops at the first step that reports
 * failures and reports the rest as skipped. Plan problems block everything (nothing is written).
 */
export async function applyWorkbook(
  deps: WorkbookApplyDeps, plan: WorkbookPlan, parsed: ParsedWorkbook, step: Step, actor: Actor, runFile: string,
): Promise<StepOutcome[]> {
  if (plan.problems.length) throw new Error(`El plan tiene problemas; no se escribe nada:\n${plan.problems.map(p => `  ✗ ${p}`).join('\n')}`);

  const steps = step === 'all' ? STEP_ORDER : [step];
  const outcomes: StepOutcome[] = [];
  let createdLists: ListOutcome[] | null = null;
  let stopped = false;
  for (const s of steps) {
    if (stopped) { outcomes.push({ step: s, status: 'skipped', lines: ['omitido'], failures: 0 }); continue; }
    let out: StepOutcome;
    try {
      if (s === 'lists') {
        const r = await runLists(deps, plan, actor);
        out = r.out;
        createdLists = r.done;
      } else if (s === 'promotions') {
        out = await runPromotions(deps, plan, parsed, actor);
      } else if (s === 'customers') {
        out = await runCustomers(deps, parsed, actor, runFile, createdLists);
      } else {
        out = await runDiscounts(deps, plan, actor);
      }
    } catch (e) {
      // Keep the summary of earlier steps: a throw becomes a failed outcome instead of escaping.
      const msg = e instanceof Error ? e.message : String(e);
      out = { step: s, status: 'failed', lines: [`✗ Error inesperado: ${msg}`], failures: 1 };
    }
    outcomes.push(out);
    if (out.status === 'failed') stopped = true;
  }
  return outcomes;
}
