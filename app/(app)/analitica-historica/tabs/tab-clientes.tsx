'use client';

import { useMemo, useState } from 'react';
import type { HistClientesResponse, HistTabProps } from '../types';
import { SectionTitle } from '../../analitica/components/resumen/stat-card';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import { HistEmpty, HistError, HistLoading } from '../components/hist-states';
import { histMoney } from '../lib/format';
import { useHistFetch } from '../lib/use-hist-fetch';

type StatusFilter = 'todos' | 'activo' | 'sin_compras';

const PILLS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Con compras en el período' },
  { value: 'sin_compras', label: 'Sin compras en el período' },
];

const nf = (n: number) => n.toLocaleString('es-VE');
const signedPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1).replace('.', ',')}%`);
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
function dateKey(key: number | null): string {
  if (key === null) return '—';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export default function TabClientes({ dateRange, currency, returnsBasis, clienteDimension }: HistTabProps) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todos');

  const { data, loading, error } = useHistFetch<HistClientesResponse>(
    `/api/dwh/analitica-historica/clientes?dateRange=${dateRange}&returnsBasis=${returnsBasis}&clienteDimension=${clienteDimension}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );

  const rows = useMemo(
    () => (data?.rows ?? []).filter(r => status === 'todos' || r.status === status),
    [data, status],
  );

  if (loading && !data) return <HistLoading />;
  if (error) return <HistError message={error} />;
  if (!data || data.empty) return <div className="p-6"><HistEmpty /></div>;

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA. Primera y última compra sobre todo el período histórico.
      </p>
      <section>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <SectionTitle>{clienteDimension === 'entidad' ? 'Clientes (casa matriz)' : 'Clientes (por tienda)'}</SectionTitle>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setQ(search.trim()); }}
              placeholder="Buscar por nombre o código"
              aria-label="Buscar cliente"
              className="border border-gray-200 rounded px-2 py-1 text-sm w-64"
            />
            <button
              type="button"
              onClick={() => setQ(search.trim())}
              className="px-3 py-1 text-sm font-medium rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Buscar
            </button>
          </div>
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Filtrar clientes">
            {PILLS.map(p => (
              <button
                key={p.value}
                onClick={() => setStatus(p.value)}
                aria-pressed={status === p.value}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  status === p.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <HistEmpty message="Ningún cliente coincide con el filtro." />
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-300 rounded-lg shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Cliente', 'Primera compra', 'Última compra', 'Facturas', 'Ventas brutas', 'Devoluciones', 'Ventas netas', '% del neto', 'Tasa dev.', 'Pareto'].map((h, i) => (
                    <th key={h} className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={r.key} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">
                      {r.name} <span className="text-xs text-gray-400">{r.code}</span>
                      {clienteDimension === 'entidad' && r.stores > 0 && (
                        <span className="ml-2 text-xs text-gray-500">{r.stores} {r.stores === 1 ? 'tienda' : 'tiendas'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{dateKey(r.firstInvoiceKey)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{dateKey(r.lastInvoiceKey)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{nf(r.invoices)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{histMoney(r.salesGross, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{histMoney(r.returns, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{histMoney(r.salesNet, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{signedPct(r.sharePct)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(r.returnRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.pareto ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
