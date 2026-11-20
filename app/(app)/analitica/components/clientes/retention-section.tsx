'use client';

import { useMemo, useState } from 'react';
import { ESTADO_LABEL, buildBridge, type Estado } from '@/lib/clientes/estado';
import type { EstadoRow, EstadosResult } from '@/lib/clientes/estados';
import { estadoMatrix, salesBridge } from '@/lib/clientes/retention';
import type { Origen } from '../../lib/clientes-params';
import { moneyLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { DataTable, type Column } from './data-table';
import { DeltaBadge } from './delta-badge';
import { EstadoBadge } from './estado-badge';

type Filter = Estado | 'accionables' | null;

const ACCIONABLES: Estado[] = ['enfriado', 'perdido'];
const MINUS = '−';

function formatDateKey(key: number | null): string {
  if (key === null) return 'Sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function reason(r: EstadoRow): string {
  if (r.reasonDateKey === null) return '—';
  return `${r.estado === 'nuevo_periodo' ? 'Primera compra' : 'Última compra'} ${formatDateKey(r.reasonDateKey)}`;
}

const DEFINITIONS: { estado: Estado; rule: string }[] = [
  { estado: 'nuevo_periodo', rule: 'Su primera factura de toda la historia cae en el período.' },
  { estado: 'retenido', rule: 'Compró en el período y también en el período anterior.' },
  { estado: 'recuperado', rule: 'Compró en el período, no en el anterior, y ya había comprado antes.' },
  { estado: 'enfriado', rule: 'Compró en el período anterior y no en este.' },
  { estado: 'perdido', rule: 'Enfriado y sin comprar hace más de 3 ventanas de su frecuencia de visita (medido hasta el cierre del período).' },
  { estado: 'sin_ventas', rule: 'Registrado, sin ninguna factura.' },
];

// Q4: is the base holding? Customer and sales bridges between the previous and the current period, the Estado x
// Origen table, and the actionable list behind every number.
export function RetentionSection({ data, currency, origen, onOrigen }: {
  data: EstadosResult;
  currency: Currency;
  origen: Origen;
  onOrigen: (o: Origen) => void;
}) {
  const [filter, setFilter] = useState<Filter>(data.available ? 'accionables' : null);
  const rows = useMemo(() => (origen === 'todos' ? data.rows : data.rows.filter(r => r.origen === origen)), [data.rows, origen]);
  const bridge = useMemo(() => buildBridge(rows.map(r => r.estado)), [rows]);
  const sales = useMemo(() => salesBridge(rows, currency), [rows, currency]);
  const matrix = useMemo(() => estadoMatrix(rows, currency), [rows, currency]);
  const listRows = useMemo(
    () => rows.filter(r => (filter === null ? true : filter === 'accionables' ? ACCIONABLES.includes(r.estado) : r.estado === filter)),
    [rows, filter],
  );

  const money = (n: number | null, signed = false) => {
    if (n === null) return '—';
    const label = moneyLabel(currency === 'usd' ? { bs: 0, usd: Math.abs(n) } : { bs: Math.abs(n), usd: 0 }, currency);
    return signed ? `${n < 0 ? MINUS : '+'}${label}` : label;
  };
  const signedCount = (n: number, sign: '+' | typeof MINUS) => `${sign}${n}`;

  const pick = (estado: Estado, col: Origen) => {
    setFilter(estado);
    if (col !== 'todos') onOrigen(col);
  };

  const columns: Column<EstadoRow>[] = [
    {
      key: 'name', label: 'Cliente', sortValue: r => r.customerName,
      render: r => (
        <span>
          {r.customerName}
          <span className="block text-xs text-gray-600">{r.customerCode}{r.entityName ? ` · ${r.entityName}` : ''}</span>
        </span>
      ),
    },
    { key: 'seller', label: 'Vendedor', sortValue: r => r.sellerName, render: r => r.sellerName ?? 'Sin vendedor' },
    { key: 'estado', label: 'Estado', sortValue: r => ESTADO_LABEL[r.estado], render: r => <EstadoBadge estado={r.estado} /> },
    { key: 'reason', label: 'Motivo', sortValue: r => r.reasonDateKey, render: r => reason(r) },
    {
      key: 'sales', label: 'Ventas del período', align: 'right', sortValue: r => (currency === 'usd' ? r.salesPeriod.usd : r.salesPeriod.bs),
      render: r => moneyLabel(r.salesPeriod, currency),
    },
    {
      key: 'prev', label: 'Ventas período anterior', align: 'right',
      sortValue: r => (r.salesPrev === null ? null : currency === 'usd' ? r.salesPrev.usd : r.salesPrev.bs),
      render: r => (r.salesPrev === null ? '—' : moneyLabel(r.salesPrev, currency)),
    },
  ];

  const countCell = (estado: Estado, col: Origen, n: number) => (
    n === 0 ? <span className="text-gray-600">0</span> : (
      <button type="button" aria-label={`${ESTADO_LABEL[estado]} ${col === 'todos' ? 'Total' : col === 'patrimonio' ? 'Patrimonio' : 'Nuevo'}`}
        onClick={() => pick(estado, col)} className="font-medium text-blue-800 hover:underline">{n}</button>
    )
  );

  const filterLabel = filter === null ? null : filter === 'accionables' ? 'Enfriados y perdidos' : ESTADO_LABEL[filter];

  return (
    <div className="space-y-4">
      {data.available ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Clientes: de un período al otro</h3>
            <ol aria-label="Puente de clientes" className="text-sm divide-y divide-gray-100">
              {[
                ['Base anterior', String(bridge.base)],
                ['Enfriados', signedCount(bridge.enfriados, MINUS)],
                ['Perdidos', signedCount(bridge.perdidos, MINUS)],
                ['Nuevos', signedCount(bridge.nuevos, '+')],
                ['Recuperados', signedCount(bridge.recuperados, '+')],
                ['Base actual', String(bridge.actual)],
              ].map(([label, value]) => (
                <li key={label} className="flex justify-between py-1"><span className="text-gray-700">{label}</span><strong className="text-gray-900">{value}</strong></li>
              ))}
            </ol>
          </div>
          <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Ventas: de un período al otro</h3>
            <ul aria-label="Puente de ventas" className="text-sm divide-y divide-gray-100">
              {[
                ['Período anterior', money(sales.previous)],
                ['Perdidas por enfriados y perdidos', money(sales.lost, true)],
                ['Variación de retenidos', money(sales.retainedChange, true)],
                ['Nuevos', money(sales.nuevos, true)],
                ['Recuperados', money(sales.recuperados, true)],
                ['Período actual', money(sales.actual)],
              ].map(([label, value]) => (
                <li key={label} className="flex justify-between py-1"><span className="text-gray-700">{label}</span><strong className="text-gray-900">{value}</strong></li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-4 py-3">Sin período anterior comparable</p>
      )}

      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 overflow-x-auto">
        <table aria-label="Estados de clientes" className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-600">
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Patrimonio</th>
              <th className="px-3 py-2 text-right">Nuevo</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Ventas del período</th>
              <th className="px-3 py-2 text-right">Δ vs anterior</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matrix.map(line => (
              <tr key={line.estado}>
                <th scope="row" className="px-3 py-2 text-left font-normal"><EstadoBadge estado={line.estado} /></th>
                <td className="px-3 py-2 text-right">{countCell(line.estado, 'patrimonio', line.patrimonio)}</td>
                <td className="px-3 py-2 text-right">{countCell(line.estado, 'nuevo', line.nuevo)}</td>
                <td className="px-3 py-2 text-right">{countCell(line.estado, 'todos', line.total)}</td>
                <td className="px-3 py-2 text-right">{money(line.sales)}</td>
                <td className="px-3 py-2 text-right">{data.available ? <DeltaBadge current={line.sales} previous={line.salesPrev} /> : <span className="text-xs text-gray-600">sin base</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2">Año de referencia {data.referenceYear}. Los clientes registrados después solo cuentan en el total.</p>
      </div>

      <details className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">¿Cómo se define?</summary>
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            <strong>Patrimonio</strong>: registrado antes del 1 de enero de {data.referenceYear} o en el lote migrado (28/03/2026).{' '}
            <strong>Nuevo</strong>: registrado durante {data.referenceYear}, fuera del lote migrado.
          </p>
          <ul className="space-y-1">
            {DEFINITIONS.map(d => (
              <li key={d.estado}><EstadoBadge estado={d.estado} /> <span className="ml-1">{d.rule}</span></li>
            ))}
          </ul>
        </div>
      </details>

      <section aria-label="Clientes por estado" className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">Clientes</h3>
          {filterLabel !== null && (
            <span className="text-xs rounded bg-gray-100 text-gray-800 px-2 py-1">
              Filtro: {filterLabel}
              <button type="button" onClick={() => setFilter(null)} className="ml-2 text-blue-800 hover:underline">Quitar filtro</button>
            </span>
          )}
          {filter !== 'accionables' && data.available && (
            <button type="button" onClick={() => setFilter('accionables')} className="text-xs text-blue-800 hover:underline">Ver enfriados y perdidos</button>
          )}
        </div>
        <DataTable<EstadoRow>
          columns={columns}
          rows={listRows}
          rowKey={r => r.customerCode}
          defaultSort={{ key: 'sales', dir: 'desc' }}
          searchText={r => `${r.customerName} ${r.customerCode} ${r.entityName ?? ''}`}
          exportFile={{
            name: 'clientes-por-estado.csv',
            toRecord: r => ({
              Cliente: r.customerName, Código: r.customerCode, 'Casa matriz': r.entityName, Vendedor: r.sellerName,
              Estado: ESTADO_LABEL[r.estado], Motivo: reason(r),
              'Ventas del período': currency === 'usd' ? r.salesPeriod.usd : r.salesPeriod.bs,
              'Ventas período anterior': r.salesPrev === null ? null : currency === 'usd' ? r.salesPrev.usd : r.salesPrev.bs,
            }),
          }}
          emptyMessage="Ningún cliente en este estado."
          pageSize={100}
        />
      </section>
    </div>
  );
}
