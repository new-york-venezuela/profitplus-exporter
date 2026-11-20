import type { DualAmount } from '@/app/(app)/analitica/types';

// Chain -> store trajectory (Clientes tab Q2). Pure roll-up of per-store aggregates under their casa matriz.
export interface StoreAggregate {
  code: string;
  name: string;
  entityKey: number | null;        // Dim_Customer.LegalEntityKey of the CURRENT row; null = no entity
  entityName: string | null;
  sales: DualAmount;                // ventas brutas sin IVA in the period (0 when no sales: an empty set is 0)
  salesPrev: DualAmount | null;     // previous equal period; null = no previous window
  units: number;
  unitsPrev: number | null;
  orders: number;                   // distinct invoices in the period
  lastOrderKey: number | null;      // last invoice ever (YYYYMMDD)
  firstInvoiceKey: number | null;   // first invoice ever
}

export interface TrayectoriaRow {
  key: string;                      // unique in the response
  filterKey: string;                // value of the Productos / Clientes `tienda` param: 'e:<LegalEntityKey>' | 't:<code>'
  parentKey: string | null;         // entity row: null; store row: its entity row's key
  kind: 'entidad' | 'tienda';
  name: string;
  code: string | null;              // store rows only
  storeCount: number;               // entity rows: stores in the response; store rows: 1
  sales: DualAmount;
  salesPrev: DualAmount | null;
  units: number;
  unitsPrev: number | null;
  orders: number;
  lastOrderKey: number | null;
  newStoresCount: number;           // stores whose first invoice ever falls inside the period
}

export interface ClientesTrayectoriaResponse {
  available: boolean;               // false = no previous equal window: every *Prev field is null
  rows: TrayectoriaRow[];
}

// A USD figure is only as good as its parts: one unknown USD makes the sum unknown, never a partial total.
function sumDual(items: DualAmount[]): DualAmount {
  return {
    bs: items.reduce((s, a) => s + a.bs, 0),
    usd: items.some(a => a.usd === null) ? null : items.reduce((s, a) => s + (a.usd as number), 0),
  };
}

function sumNullable(items: (number | null)[]): number | null {
  return items.some(v => v === null) ? null : items.reduce<number>((s, v) => s + (v as number), 0);
}

export function rollUpTrayectoria(stores: StoreAggregate[], period: { periodStartKey: number; periodEndKey: number }): TrayectoriaRow[] {
  const isNew = (s: StoreAggregate) =>
    s.firstInvoiceKey !== null && s.firstInvoiceKey >= period.periodStartKey && s.firstInvoiceKey <= period.periodEndKey;

  const groups = new Map<string, StoreAggregate[]>();
  for (const s of stores) {
    const k = s.entityKey === null ? `o:${s.code}` : `e:${s.entityKey}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  const entities: TrayectoriaRow[] = [];
  const storeRows: TrayectoriaRow[] = [];
  for (const [key, members] of groups) {
    const orphan = key.startsWith('o:');
    const lasts = members.map(m => m.lastOrderKey).filter((v): v is number => v !== null);
    entities.push({
      key,
      filterKey: orphan ? `t:${members[0].code}` : key,
      parentKey: null,
      kind: 'entidad',
      name: orphan ? members[0].name : (members[0].entityName ?? members[0].name),
      code: null,
      storeCount: members.length,
      sales: sumDual(members.map(m => m.sales)),
      salesPrev: members.every(m => m.salesPrev !== null) ? sumDual(members.map(m => m.salesPrev as DualAmount)) : null,
      units: members.reduce((s, m) => s + m.units, 0),
      unitsPrev: sumNullable(members.map(m => m.unitsPrev)),
      orders: members.reduce((s, m) => s + m.orders, 0),
      lastOrderKey: lasts.length > 0 ? Math.max(...lasts) : null,
      newStoresCount: members.filter(isNew).length,
    });
    for (const m of members) {
      storeRows.push({
        key: `t:${m.code}`,
        filterKey: `t:${m.code}`,
        parentKey: key,
        kind: 'tienda',
        name: m.name,
        code: m.code,
        storeCount: 1,
        sales: m.sales,
        salesPrev: m.salesPrev,
        units: m.units,
        unitsPrev: m.unitsPrev,
        orders: m.orders,
        lastOrderKey: m.lastOrderKey,
        newStoresCount: isNew(m) ? 1 : 0,
      });
    }
  }
  entities.sort((a, b) => b.sales.bs - a.sales.bs);
  const order = new Map(entities.map((e, i) => [e.key, i]));
  storeRows.sort((a, b) => (order.get(a.parentKey as string) ?? 0) - (order.get(b.parentKey as string) ?? 0) || b.sales.bs - a.sales.bs);
  return [...entities, ...storeRows];
}
