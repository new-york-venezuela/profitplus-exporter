'use client';

import { useState } from 'react';
import type { HistGroupBy, HistGroupResponse, HistResumenResponse, HistTabProps } from '../types';
import { SectionTitle } from '../../analitica/components/resumen/stat-card';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import { HistVentasStrip } from '../components/hist-ventas-strip';
import { HistGroupTable } from '../components/hist-group-table';
import { HistEmpty, HistError, HistLoading } from '../components/hist-states';
import { useHistFetch } from '../lib/use-hist-fetch';

const GROUPS: { value: Exclude<HistGroupBy, 'producto'>; label: string }[] = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'linea', label: 'Línea' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'mes', label: 'Período' },
];

export default function TabVentas({ dateRange, currency, granularity, returnsBasis }: HistTabProps) {
  const [groupBy, setGroupBy] = useState<Exclude<HistGroupBy, 'producto'>>('cliente');
  const [linea, setLinea] = useState<{ value: string; label: string } | null>(null);

  const query = `dateRange=${dateRange}&granularity=${granularity}&returnsBasis=${returnsBasis}`;
  const strip = useHistFetch<HistResumenResponse>(`/api/dwh/analitica-historica/resumen?${query}`);
  const drilled = groupBy === 'linea' && linea !== null;
  const table = useHistFetch<HistGroupResponse>(
    `/api/dwh/analitica-historica/ventas?${query}&groupBy=${drilled ? 'producto' : groupBy}${drilled ? `&parentValue=${encodeURIComponent(linea.value)}` : ''}`,
  );

  const firstColumn = drilled ? 'Producto' : GROUPS.find(g => g.value === groupBy)!.label;

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA.
      </p>

      {strip.data?.kpis && (
        <section>
          <SectionTitle>Ventas del período</SectionTitle>
          <HistVentasStrip kpis={strip.data.kpis} currency={currency} />
        </section>
      )}

      <section>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <SectionTitle>Ventas por</SectionTitle>
          <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Agrupar ventas por">
            {GROUPS.map(g => (
              <button
                key={g.value}
                onClick={() => { setGroupBy(g.value); setLinea(null); }}
                aria-pressed={groupBy === g.value}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  groupBy === g.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {drilled && (
            <button onClick={() => setLinea(null)} className="text-xs text-blue-600 hover:underline">
              ← Líneas · {linea.label}
            </button>
          )}
        </div>
        {table.loading && <HistLoading />}
        {!table.loading && table.error && <HistError message={table.error} />}
        {!table.loading && !table.error && (!table.data || table.data.rows.length === 0) && <HistEmpty />}
        {!table.loading && !table.error && table.data && table.data.rows.length > 0 && (
          <HistGroupTable
            rows={table.data.rows}
            currency={currency}
            firstColumnLabel={firstColumn}
            onRowClick={groupBy === 'linea' && !drilled ? row => setLinea({ value: row.value, label: row.label }) : undefined}
          />
        )}
      </section>
    </div>
  );
}
