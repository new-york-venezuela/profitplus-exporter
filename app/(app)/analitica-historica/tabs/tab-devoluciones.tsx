'use client';

import { useState } from 'react';
import type { HistDevolucionesResponse, HistTabProps } from '../types';
import { SectionTitle, StatCard, Row } from '../../analitica/components/resumen/stat-card';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import { HistEmpty, HistError, HistLoading } from '../components/hist-states';
import { histMoney } from '../lib/format';
import { useHistFetch } from '../lib/use-hist-fetch';

const GROUPS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'sku', label: 'Producto' },
  { value: 'mes', label: 'Período' },
] as const;

const nf = (n: number) => n.toLocaleString('es-VE');
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

export default function TabDevoluciones({ dateRange, currency, granularity, returnsBasis }: HistTabProps) {
  const [groupBy, setGroupBy] = useState<(typeof GROUPS)[number]['value']>('cliente');
  const { data, loading, error } = useHistFetch<HistDevolucionesResponse>(
    `/api/dwh/analitica-historica/devoluciones?dateRange=${dateRange}&granularity=${granularity}&returnsBasis=${returnsBasis}&groupBy=${groupBy}`,
  );

  if (loading && !data) return <HistLoading />;
  if (error) return <HistError message={error} />;
  if (!data || data.empty || !data.kpis) return <div className="p-6"><HistEmpty /></div>;

  const k = data.kpis;
  const firstColumn = GROUPS.find(g => g.value === groupBy)!.label;

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA; USD a la tasa de la factura original.
      </p>

      <section>
        <SectionTitle>Devoluciones del período</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard label="Devoluciones" value={histMoney(k.returns, currency)} warn={k.returnRate !== null && k.returnRate > 0.05}>
            <Row label="Tasa de devolución" value={pct(k.returnRate)} />
            <Row label="Unidades" value={nf(k.unitsReturned)} />
          </StatCard>
          <StatCard label="Ventas brutas del período" value={histMoney(k.salesGross, currency)}>
            <Row label="Unidades" value={nf(k.unitsSold)} />
          </StatCard>
          <StatCard label="Clientes con devoluciones" value={nf(k.customersWithReturns)}>
            <Row label="Clientes con ventas" value={nf(k.customersWithSales)} />
          </StatCard>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <SectionTitle>Devoluciones por</SectionTitle>
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Agrupar devoluciones por">
            {GROUPS.map(g => (
              <button
                key={g.value}
                onClick={() => setGroupBy(g.value)}
                aria-pressed={groupBy === g.value}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  groupBy === g.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {data.rows.length === 0 ? (
          <HistEmpty message="Sin devoluciones en el período seleccionado." />
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-300 rounded-lg shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{firstColumn}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Devoluciones</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ventas brutas</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r, i) => (
                  <tr key={r.value} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{r.label}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{histMoney(r.returns, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{histMoney(r.salesGross, currency)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(r.returnRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{nf(r.unitsReturned)}</td>
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
