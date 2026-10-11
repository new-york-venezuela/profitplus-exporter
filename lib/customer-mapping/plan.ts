import { looseCustomerKey, resolveSeller } from './codes';
import type { DocKind, ErpCustomerState, SellerDoc } from './erp';
import type { MappingRow } from './types';

export interface PlanInput {
  rows: MappingRow[];
  customers: Map<string, ErpCustomerState>;
  activeSellers: string[];
  segments: { byDesc: Map<string, string>; codes: Set<string> };
  docs: SellerDoc[];
  since: string;
}

export interface PlanProblem { kind: 'unknown_customer' | 'unknown_seller'; coCli: string; detail: string }

export interface Plan {
  customerSeller: { coCli: string; from: string; to: string }[];
  customerSegment: { coCli: string; from: string | null; to: string; grupo: string }[];
  docSeller: { kind: DocKind; docNum: string; coCli: string; from: string; to: string }[];
  segmentsToCreate: { coSeg: string; segDes: string }[];
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
  const plan: Plan = { customerSeller: [], customerSegment: [], docSeller: [], segmentsToCreate: [], problems: [] };

  const docsByCustomer = new Map<string, SellerDoc[]>();
  for (const d of input.docs) {
    if (d.fecEmis < input.since) continue;
    const list = docsByCustomer.get(d.coCli) ?? [];
    list.push(d);
    docsByCustomer.set(d.coCli, list);
  }

  const looseIndex = new Map<string, string[]>();
  for (const code of input.customers.keys()) {
    const k = looseCustomerKey(code);
    looseIndex.set(k, [...(looseIndex.get(k) ?? []), code]);
  }

  // Groups with no saSegmento row yet get a generated code (shown in the dry-run).
  const missingGroups = [...new Set(
    input.rows.map(r => r.grupo.trim()).filter(g => !input.segments.byDesc.has(g.toLowerCase())),
  )];
  const newCodes = assignSegmentCodes(missingGroups, input.segments.codes);
  for (const g of missingGroups) plan.segmentsToCreate.push({ coSeg: newCodes.get(g)!, segDes: g });

  for (const r of input.rows) {
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
    const toSeg = input.segments.byDesc.get(grupo.toLowerCase()) ?? newCodes.get(grupo)!;
    if ((erp.coSeg ?? '') !== toSeg) {
      plan.customerSegment.push({ coCli: r.coCli, from: erp.coSeg, to: toSeg, grupo });
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
