'use client';

import type { HistResumenResponse, HistTabProps } from '../types';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import { SectionTitle } from '../../analitica/components/resumen/stat-card';
import { SalesReturnsChart } from '../../analitica/components/resumen/sales-returns-chart';
import { HistVentasStrip } from '../components/hist-ventas-strip';
import { HistEmpty, HistError, HistLoading } from '../components/hist-states';
import { useHistFetch } from '../lib/use-hist-fetch';

export default function TabResumen({ dateRange, currency, granularity, returnsBasis }: HistTabProps) {
  const { data, loading, error } = useHistFetch<HistResumenResponse>(
    `/api/dwh/analitica-historica/resumen?dateRange=${dateRange}&granularity=${granularity}&returnsBasis=${returnsBasis}`,
  );

  if (loading) return <HistLoading />;
  if (error) return <HistError message={error} />;
  if (!data || data.empty || !data.kpis) return <div className="p-6"><HistEmpty /></div>;

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA.
      </p>
      <section>
        <SectionTitle>Ventas del período</SectionTitle>
        <HistVentasStrip kpis={data.kpis} currency={currency} />
      </section>
      <p className="text-xs text-gray-500">Gráfico: devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}.</p>
      <SalesReturnsChart rows={data.trend} trendMode={data.trendMode} currency={currency} />
    </div>
  );
}
