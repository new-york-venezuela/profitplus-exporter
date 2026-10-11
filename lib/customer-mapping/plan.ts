import { looseCustomerKey, resolveSeller } from './codes';
import type { DocKind, ErpCustomerState, SellerDoc } from './erp';
import type { VisitFrequency } from './frequency';
import { checkCoherence, type CoherenceKind } from './route-owners';
import { routeZoneCode, routeZoneName } from './route-zones';
import type { MappingRow } from './types';

export interface PlanInput {
  rows: MappingRow[];
  customers: Map<string, ErpCustomerState>;
  activeSellers: string[];
  segments: { byDesc: Map<string, string>; codes: Set<string> };
  zones: Set<string>;               // trimmed saZona codes that already exist
  docs: SellerDoc[];
  since: string;
}

export interface PlanProblem {
  kind: 'unknown_customer' | 'unknown_seller' | 'duplicate_mapping_row' | CoherenceKind;
  coCli: string;
  detail: string;
}

export interface Plan {
  customerSeller: { coCli: string; from: string; to: string }[];
  customerSegment: { coCli: string; from: string | null; to: string; grupo: string }[];
  customerRoute: { coCli: string; fromZon: string; fromFrec: string | null; toZon: string; toFrec: VisitFrequency }[];
  docSeller: { kind: DocKind; docNum: string; coCli: string; from: string; to: string }[];
  segmentsToCreate: { coSeg: string; segDes: string }[];
  zonesToCreate: { coZon: string; zonDes: string }[];
  problems: PlanProblem[];
}

export function assignSegmentCodes(groups: string[], existing: Set<string>): Map<string, string> {
  const used = new Set(existing);
  const out = new Map<string, string>();
  let n = 1;
  for (const g of [...groups].sort((a, b) => a.localeCompare(b))) {
    let code: string;
    do { code = `GRP${String(n++).padStart(2, '0')}`; } while (used.has(code));
    used.add(code);
    out.set(g, code);
  }
  return out;
}

export function buildPlan(input: PlanInput): Plan {
  const plan: Plan = {
    customerSeller: [], customerSegment: [], customerRoute: [], docSeller: [],
    segmentsToCreate: [], zonesToCreate: [], problems: [],
  };

  const docsByCustomer = new Map<string, SellerDoc[]>();
  for (const d of input.docs) {
    if (d.fecEmis < input.since) continue;
    const list = docsByCustomer.get(d.coCli) ?? [];
    list.push(d);
    docsByCustomer.set(d.coCli, list);
  }

  // Coherence runs over the first row of each customer (later duplicates are reported separately).
  const unique = new Map<string, MappingRow>();
  for (const r of input.rows) if (!unique.has(r.coCli)) unique.set(r.coCli, r);
  for (const i of checkCoherence([...unique.values()])) {
    plan.problems.push({ kind: i.kind, coCli: i.coCli, detail: i.detail });
  }
  const routes = [...new Set([...unique.values()].filter(r => r.ruta != null).map(r => r.ruta!))].sort((a, b) => a - b);
  for (const n of routes) {
    const coZon = routeZoneCode(n);
    if (!input.zones.has(coZon)) plan.zonesToCreate.push({ coZon, zonDes: routeZoneName(n) });
  }

  const looseIndex = new Map<string, string[]>();
  for (const code of input.customers.keys()) {
    const k = looseCustomerKey(code);
    looseIndex.set(k, [...(looseIndex.get(k) ?? []), code]);
  }

  // Groups with no saSegmento row yet get a generated code (shown in the dry-run).
  // Deduplicated by trimmed, lower-cased key; the first-seen spelling is the segment description.
  const missingByKey = new Map<string, string>();
  for (const r of input.rows) {
    const g = r.grupo.trim();
    const k = g.toLowerCase();
    if (!input.segments.byDesc.has(k) && !missingByKey.has(k)) missingByKey.set(k, g);
  }
  const missingGroups = [...missingByKey.values()];
  const newCodes = assignSegmentCodes(missingGroups, input.segments.codes);
  for (const g of missingGroups) plan.segmentsToCreate.push({ coSeg: newCodes.get(g)!, segDes: g });

  const seenCustomers = new Set<string>();
  for (const r of input.rows) {
    if (seenCustomers.has(r.coCli)) {
      plan.problems.push({
        kind: 'duplicate_mapping_row', coCli: r.coCli,
        detail: `fila duplicada en el mapeo para ${r.coCli}; solo se usa la primera`,
      });
      continue;
    }
    seenCustomers.add(r.coCli);

    const erp = input.customers.get(r.coCli);
    if (!erp) {
      const sugg = looseIndex.get(looseCustomerKey(r.coCli)) ?? [];
      plan.problems.push({
        kind: 'unknown_customer', coCli: r.coCli,
        detail: sugg.length ? `no existe en el ERP; ¿quizás ${sugg.join(' / ')}?` : 'no existe en el ERP',
      });
      continue;
    }

    const grupo = r.grupo.trim();
    const groupKey = grupo.toLowerCase();
    const toSeg = input.segments.byDesc.get(groupKey) ?? newCodes.get(missingByKey.get(groupKey)!)!;
    if ((erp.coSeg ?? '') !== toSeg) {
      plan.customerSegment.push({ coCli: r.coCli, from: erp.coSeg, to: toSeg, grupo });
    }

    if (r.ruta != null) {
      const toZon = routeZoneCode(r.ruta);
      const fromFrec = (erp.frecuVist ?? '').trim().toUpperCase();
      if (erp.coZon !== toZon || fromFrec !== r.frecuencia) {
        plan.customerRoute.push({ coCli: r.coCli, fromZon: erp.coZon, fromFrec: erp.frecuVist, toZon, toFrec: r.frecuencia });
      }
    }

    if (!r.coVen.trim()) continue;
    const seller = resolveSeller(r.coVen, input.activeSellers);
    if (!seller) {
      plan.problems.push({ kind: 'unknown_seller', coCli: r.coCli, detail: `vendedor '${r.coVen}' no existe o está inactivo en el ERP` });
      continue;
    }
    if (erp.coVen !== seller) plan.customerSeller.push({ coCli: r.coCli, from: erp.coVen, to: seller });
    for (const d of docsByCustomer.get(r.coCli) ?? []) {
      if (d.coVen !== seller) {
        plan.docSeller.push({ kind: d.kind, docNum: d.docNum, coCli: r.coCli, from: d.coVen, to: seller });
      }
    }
  }
  return plan;
}
