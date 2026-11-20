'use client';

import { useMemo } from 'react';
import type { Estado } from '@/lib/clientes/estado';
import type { TrayectoriaRow } from '@/lib/clientes/trayectoria';
import type { Dim } from '../../lib/clientes-params';
import { moneyLabel } from '../../lib/format';
import type { Currency, DualAmount } from '../../types';
import { DataTable, type Column } from './data-table';
import { DeltaBadge } from './delta-badge';
import { EstadoBadge } from './estado-badge';

const amount = (a: DualAmount | null, currency: Currency): number | null => (a === null ? null : currency === 'usd' ? a.usd : a.bs);

function formatDateKey(key: number | null): string {
  if (key === null) return 'Sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

// Q2: sales trajectory per casa matriz (expandable to its stores) or per store. Selecting a row scopes the tab
// (and the product view) to that chain or store through its filterKey.
export function TrajectoryTable({ rows, currency, dim, selectedKey, onSelect, estadoByCode }: {
  rows: TrayectoriaRow[];
  currency: Currency;
  dim: Dim;
  selectedKey: string | null;
  onSelect: (filterKey: string | null) => void;
  estadoByCode: ReadonlyMap<string, Estado>;
}) {
  const children = useMemo(() => {
    const map = new Map<string, TrayectoriaRow[]>();
    for (const r of rows) if (r.parentKey !== null) map.set(r.parentKey, [...(map.get(r.parentKey) ?? []), r]);
    return map;
  }, [rows]);
  const top = useMemo(() => rows.filter(r => (dim === 'entidad' ? r.kind === 'entidad' : r.kind === 'tienda')), [rows, dim]);

  const delta = (r: TrayectoriaRow): number | null => {
    const cur = amount(r.sales, currency);
    const prev = amount(r.salesPrev, currency);
    return cur === null || prev === null ? null : cur - prev;
  };

  const columns: Column<TrayectoriaRow>[] = [
    {
      key: 'name', label: dim === 'entidad' ? 'Casa matriz' : 'Tienda', sortValue: r => r.name,
      render: r => (
        <span className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-label={`Seleccionar ${r.name}`}
            aria-pressed={selectedKey === r.filterKey}
            onClick={() => onSelect(selectedKey === r.filterKey ? null : r.filterKey)}
            className={`text-left hover:underline ${selectedKey === r.filterKey ? 'font-bold text-blue-800' : 'text-gray-900'}`}
          >
            {r.name}
          </button>
          {r.kind === 'entidad' && r.storeCount > 1 && <span className="text-xs text-gray-600">{r.storeCount} tiendas</span>}
          {r.newStoresCount > 0 && r.kind === 'entidad' && (
            <span className="text-xs rounded bg-emerald-100 text-emerald-900 px-1.5 py-0.5">+{r.newStoresCount} tiendas nuevas</span>
          )}
        </span>
      ),
    },
    { key: 'sales', label: 'Ventas', align: 'right', sortValue: r => amount(r.sales, currency), render: r => moneyLabel(r.sales, currency) },
    {
      key: 'delta', label: 'Δ vs anterior', align: 'right', sortValue: delta,
      render: r => <DeltaBadge current={amount(r.sales, currency)} previous={amount(r.salesPrev, currency)} />,
      title: 'Cambio de las ventas brutas frente al período anterior equivalente',
    },
    { key: 'units', label: 'Unidades', align: 'right', sortValue: r => r.units, render: r => new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(r.units) },
    { key: 'orders', label: 'Pedidos', align: 'right', sortValue: r => r.orders, render: r => String(r.orders) },
    { key: 'last', label: 'Última compra', align: 'right', sortValue: r => r.lastOrderKey, render: r => formatDateKey(r.lastOrderKey) },
    {
      key: 'estado', label: 'Estado',
      render: r => {
        const e = r.kind === 'tienda' && r.code !== null ? estadoByCode.get(r.code) : undefined;
        return e ? <EstadoBadge estado={e} /> : <span className="text-gray-600">—</span>;
      },
    },
  ];

  return (
    <DataTable<TrayectoriaRow>
      columns={columns}
      rows={top}
      rowKey={r => r.key}
      defaultSort={{ key: 'delta', dir: 'desc' }}
      searchText={r => r.name}
      exportFile={{
        name: 'trayectoria-clientes.csv',
        toRecord: r => ({
          [dim === 'entidad' ? 'Casa matriz' : 'Tienda']: r.name,
          Ventas: amount(r.sales, currency),
          'Ventas período anterior': amount(r.salesPrev, currency),
          Unidades: r.units,
          Pedidos: r.orders,
          'Última compra': formatDateKey(r.lastOrderKey),
          'Tiendas nuevas': r.newStoresCount,
        }),
      }}
      emptyMessage="Sin ventas en el período para este alcance."
      isExpandable={r => dim === 'entidad' && r.kind === 'entidad' && r.storeCount > 1}
      renderExpanded={r => (
        <ul className="text-sm divide-y divide-gray-200">
          {(children.get(r.key) ?? []).map(s => (
            <li key={s.key} className="py-1.5 flex items-center justify-between gap-4">
              <span className="text-gray-900">{s.name}</span>
              <span className="flex items-center gap-4 text-gray-700">
                <span>{moneyLabel(s.sales, currency)}</span>
                <DeltaBadge current={amount(s.sales, currency)} previous={amount(s.salesPrev, currency)} />
                {s.code !== null && estadoByCode.get(s.code) && <EstadoBadge estado={estadoByCode.get(s.code) as Estado} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
