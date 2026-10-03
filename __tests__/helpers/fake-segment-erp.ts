import type { SegmentErp } from '@/lib/pricing/segments-service';
import type { SegmentRow } from '@/lib/pricing/tipo-cliente';

export interface FakeSegmentState {
  segments: SegmentRow[];
  customers: Record<string, { cliDes: string; tipCli: string }>;
  conflictNext: boolean;
  moveConflict: boolean;
}

export function makeFakeSegmentErp(seed: { segments: SegmentRow[]; customers: Record<string, { cliDes: string; tipCli: string }> }) {
  const state: FakeSegmentState = { segments: [...seed.segments], customers: { ...seed.customers }, conflictNext: false, moveConflict: false };
  const erp: SegmentErp & { listCustomersInSegment(tipCli: string): Promise<{ coCli: string; cliDes: string }[]> } = {
    listCodes: async () => state.segments.map(s => s.tipCli),
    listSegments: async () => state.segments,
    getSegment: async t => state.segments.find(s => s.tipCli === t) ?? null,
    createSegment: async p => { state.segments.push({ tipCli: p.tipCli, desTipo: p.desTipo, coPrecio: p.coPrecio, desPrecio: null, customerCount: 0, validador: '0x0000000000000001' }); },
    updateSegment: async p => {
      if (state.conflictNext) return 'conflict';
      const s = state.segments.find(x => x.tipCli === p.tipCli)!;
      if (p.desTipo) s.desTipo = p.desTipo;
      if (p.coPrecio) s.coPrecio = p.coPrecio;
      return 'success';
    },
    getCustomer: async c => state.customers[c] ? { coCli: c, ...state.customers[c] } : null,
    moveCustomer: async (c, target) => {
      const cur = state.customers[c];
      if (!cur) return { coCli: c, outcome: 'error', message: 'Cliente no encontrado' };
      if (state.moveConflict) return { coCli: c, outcome: 'conflict' };
      const previousTipCli = cur.tipCli;
      cur.tipCli = target;
      return { coCli: c, outcome: 'success', previousTipCli };
    },
    listCustomersInSegment: async tipCli =>
      Object.entries(state.customers).filter(([, c]) => c.tipCli === tipCli).map(([coCli, c]) => ({ coCli, cliDes: c.cliDes })),
  };
  const setCustomers = (customers: FakeSegmentState['customers']) => { state.customers = { ...customers }; };
  return { erp, state, setCustomers };
}
