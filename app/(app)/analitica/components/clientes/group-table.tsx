'use client';

import type { GrupoBy, GrupoRow } from '@/lib/clientes/grupos';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { DataTable, type Column } from './data-table';
import { DeltaBadge } from './delta-badge';

const amountOf = (a: { bs: number; usd: number | null } | null, currency: Currency): number | null =>
  a === null ? null : currency === 'usd' ? a.usd : a.bs;

const pct = (n: number | null): string => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

// Q3: sales by grupo or ruta, ranked by the change against the previous equal period. Selecting a row filters
// the tab to that grupo or ruta; the "sin grupo / sin ruta" row has no code to filter by, so it is not selectable.
export function GroupTable({ rows, by, currency, selectedKey, onSelect }: {
  rows: GrupoRow[];
  by: GrupoBy;
  currency: Currency;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const delta = (r: GrupoRow): number | null => {
    const cur = amountOf(r.sales, currency);
    const prev = amountOf(r.salesPrev, currency);
    return cur === null || prev === null ? null : cur - prev;
  };

  const columns: Column<GrupoRow>[] = [
    {
      key: 'name', label: by === 'grupo' ? 'Grupo' : 'Ruta', sortValue: r => r.name,
      render: r => (r.key === '' ? <span className="text-gray-700">{r.name}</span> : (
        <button
          type="button"
          aria-label={`Seleccionar ${r.name}`}
          aria-pressed={selectedKey === r.key}
          onClick={() => onSelect(selectedKey === r.key ? null : r.key)}
          className={`text-left hover:underline ${selectedKey === r.key ? 'font-bold text-blue-800' : 'text-gray-900'}`}
        >
          {r.name}
        </button>
      )),
    },
    {
      key: 'sales', label: 'Ventas', align: 'right', sortValue: r => amountOf(r.sales, currency),
      render: r => (
        <span className="inline-flex items-center gap-2 justify-end">
          <span>{moneyLabel(r.sales, currency)}</span>
          {r.shareOfTotal === null ? <span className="text-xs text-gray-600">—</span> : (
            <>
              <span role="meter" aria-label={`Participación de ${r.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.shareOfTotal * 1000) / 10} className="inline-block w-16 h-2 rounded bg-gray-200">
                <span className="block h-2 rounded bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, r.shareOfTotal * 100))}%` }} />
              </span>
              <span className="text-xs text-gray-700 w-12 text-right">{pct(r.shareOfTotal)}</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'delta', label: 'Δ vs anterior', align: 'right', sortValue: delta,
      render: r => <DeltaBadge current={amountOf(r.sales, currency)} previous={amountOf(r.salesPrev, currency)} />,
      title: 'Cambio de las ventas brutas frente al período anterior equivalente',
    },
    { key: 'activos', label: 'Clientes activos', align: 'right', sortValue: r => r.activos, render: r => String(r.activos) },
    { key: 'mix', label: 'Nuevos · Patrimonio', align: 'right', sortValue: r => r.nuevos, render: r => `${r.nuevos} · ${r.patrimonio}` },
    { key: 'churn', label: 'Abandono', align: 'right', sortValue: r => r.churnRate, render: r => pct(r.churnRate), title: 'Compradores del período anterior que no compraron en este' },
  ];

  return (
    <DataTable<GrupoRow>
      columns={columns}
      rows={rows}
      rowKey={r => `${by}:${r.key}`}
      defaultSort={{ key: 'delta', dir: 'desc' }}
      searchText={r => r.name}
      exportFile={{
        name: `ventas-por-${by}.csv`,
        toRecord: r => ({
          [by === 'grupo' ? 'Grupo' : 'Ruta']: r.name,
          Ventas: amountOf(r.sales, currency),
          'Ventas período anterior': amountOf(r.salesPrev, currency),
          'Participación': r.shareOfTotal,
          'Clientes activos': r.activos,
          Nuevos: r.nuevos,
          Patrimonio: r.patrimonio,
          Abandono: r.churnRate,
        }),
      }}
      emptyMessage={by === 'grupo' ? 'Ningún grupo con clientes en este alcance.' : 'Ninguna ruta con clientes en este alcance.'}
    />
  );
}
