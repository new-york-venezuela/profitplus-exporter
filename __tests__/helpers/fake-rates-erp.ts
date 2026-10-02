import type { RatesErp } from '@/lib/pricing/lists-service';
import type { ApplyOutcome, ArticleRow, PriceListRow } from '@/lib/pricing/rates-erp';
import { planRatePeriod, type RateRow } from '@/lib/pricing/rate-planner';

export interface FakeList { coPrecio: string; desPrecio: string; validador?: string }
export interface FakeRatesState {
  lists: FakeList[];
  articles: { coArt: string; artDes: string; coCat?: string | null; catDes?: string | null }[];
  rates: RateRow[];
  customers: Record<string, { cliDes: string; tipCli: string; coPrecio: string | null }>;
  currencies: string[];
  failCloneOnce: boolean;
  conflictNext: boolean;
}

export function makeFakeRatesErp(seed: {
  lists: FakeList[];
  articles?: FakeRatesState['articles'];
  rates?: RateRow[];
  customers?: FakeRatesState['customers'];
}): { erp: RatesErp; state: FakeRatesState } {
  const state: FakeRatesState = {
    lists: seed.lists.map(l => ({ ...l })),
    articles: [...(seed.articles ?? [])],
    rates: (seed.rates ?? []).map(r => ({ ...r })),
    customers: { ...(seed.customers ?? {}) },
    currencies: [],
    failCloneOnce: false,
    conflictNext: false,
  };
  let seq = 1;
  const nextValidador = () => `0x${(seq++).toString(16).padStart(16, '0')}`;
  const toRow = (l: FakeList): PriceListRow => {
    const rs = state.rates.filter(r => r.coPrecio === l.coPrecio);
    const counts = new Map<string, number>();
    for (const r of rs) if (r.coMone) counts.set(r.coMone, (counts.get(r.coMone) ?? 0) + 1);
    const coMone = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      coPrecio: l.coPrecio, desPrecio: l.desPrecio, coMone, rateCount: rs.length, segmentCount: 0,
      customerCount: Object.values(state.customers).filter(c => c.coPrecio === l.coPrecio).length,
      validador: l.validador ?? '0x0000000000000001',
    };
  };
  const dominant = (rs: RateRow[]): string | null => {
    const counts = new Map<string, number>();
    for (const r of rs) counts.set(r.coAlma, (counts.get(r.coAlma) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  };

  const erp: RatesErp = {
    listLists: async () => state.lists.map(toRow),
    getList: async c => { const l = state.lists.find(x => x.coPrecio === c); return l ? toRow(l) : null; },
    listCodes: async () => state.lists.map(l => l.coPrecio),
    listCurrencies: async () => [...new Set([...state.rates.map(r => r.coMone).filter((m): m is string => !!m), ...state.currencies, 'BSD', 'USD'])].sort(),
    readListRates: async c => state.rates.filter(r => r.coPrecio === c).map(r => ({ ...r })),
    readArticleRates: async a => state.rates.filter(r => r.coArt === a).map(r => ({ ...r })),
    dominantWarehouse: async c => dominant(c ? state.rates.filter(r => r.coPrecio === c) : state.rates),
    listArticles: async ({ search }) => state.articles
      .filter(a => !search || a.artDes.toLowerCase().includes(search.toLowerCase()) || a.coArt.toLowerCase().includes(search.toLowerCase()))
      .map((a): ArticleRow => ({ coArt: a.coArt, artDes: a.artDes, coCat: a.coCat ?? null, catDes: a.catDes ?? null })),
    getCustomerPriceList: async c => {
      const x = state.customers[c];
      return x ? { coCli: c, cliDes: x.cliDes, tipCli: x.tipCli, coPrecio: x.coPrecio } : null;
    },
    applyRatePeriod: async a => {
      const rows = state.rates.filter(r => r.coArt === a.coArt && r.coPrecio === a.coPrecio && r.coAlma === a.coAlma);
      const plan = planRatePeriod(rows.map(r => ({ ...r })), { from: a.from, to: a.to, monto: a.monto, today: a.today });
      if (!plan.ok) return { outcome: 'rejected', message: plan.error } satisfies ApplyOutcome;
      if (plan.skipped) return { outcome: 'skipped' };
      for (const op of plan.ops) {
        if (op.type === 'insert') {
          state.rates.push({ coArt: a.coArt, coPrecio: a.coPrecio, coAlma: a.coAlma, desde: op.desde, hasta: op.hasta, monto: op.monto, coMone: a.coMone, validador: nextValidador() });
        } else {
          const target = state.rates.find(r => r.coArt === op.row.coArt && r.coPrecio === op.row.coPrecio && r.coAlma === op.row.coAlma && r.desde === op.row.desde);
          if (!target) return { outcome: 'conflict' };
          if (op.set.desde !== undefined) target.desde = op.set.desde;
          if ('hasta' in op.set) target.hasta = op.set.hasta ?? null;
          if (op.set.monto !== undefined) target.monto = op.set.monto;
          target.validador = nextValidador();
        }
      }
      return { outcome: 'success' };
    },
    createList: async p => { state.lists.push({ coPrecio: p.coPrecio, desPrecio: p.desPrecio }); },
    updateList: async p => {
      if (state.conflictNext) { state.conflictNext = false; return 'conflict'; }
      const l = state.lists.find(x => x.coPrecio === p.coPrecio);
      if (!l) return 'conflict';
      l.desPrecio = p.desPrecio; l.validador = nextValidador();
      return 'success';
    },
    cloneList: async p => {
      if (state.failCloneOnce) { state.failCloneOnce = false; throw new Error('clone failed'); }
      const known = new Set(state.articles.map(a => a.coArt));
      if (p.rows.some(r => !known.has(r.coArt))) throw new Error('Artículo desconocido');
      state.lists.push({ coPrecio: p.coPrecio, desPrecio: p.desPrecio });
      for (const r of p.rows) {
        state.rates.push({ coArt: r.coArt, coPrecio: p.coPrecio, coAlma: r.coAlma, desde: p.from, hasta: null, monto: r.monto, coMone: p.coMone, validador: nextValidador() });
      }
    },
  };
  return { erp, state };
}
