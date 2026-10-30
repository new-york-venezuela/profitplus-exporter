'use client';

import { useEffect, useState } from 'react';
import type { Currency, DateRange, ResumenResponse } from '../types';
import { periodLabel } from '../lib/period-label';
import type { Granularity } from '../lib/granularity';
import { SectionTitle } from '../components/resumen/stat-card';
import { VentasStrip } from '../components/resumen/ventas-strip';
import { ClientesCards } from '../components/resumen/clientes-cards';
import { CxcCards } from '../components/resumen/cxc-cards';
import { SalesReturnsChart } from '../components/resumen/sales-returns-chart';

function formatSnapshotDate(key: number | null): string {
  if (key === null) return 'sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

export default function TabResumen({
  dateRange,
  currency,
  granularity,
}: {
  dateRange: DateRange;
  currency: Currency;
  granularity: Granularity;
}) {
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/resumen?dateRange=${dateRange}&granularity=${granularity}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ResumenResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, granularity]);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-gray-500">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-3">
        <EmptyState />
      </div>
    );
  }

  const periodo = periodLabel(dateRange);

  return (
    <div className="p-6 w-full space-y-6">
      {/* KPI row — every figure is for the selected range (periodo). */}
      <p className="text-xs text-gray-500">
        Período: {periodo}. Devoluciones atribuidas a la fecha de su factura original, sin IVA.
      </p>
      <section>
        <SectionTitle>Ventas del período</SectionTitle>
        <VentasStrip kpis={data.kpis} currency={currency} />
      </section>
      <section>
        <SectionTitle>Clientes</SectionTitle>
        <ClientesCards kpis={data.kpis} />
      </section>
      <section>
        <SectionTitle>Cuentas por cobrar</SectionTitle>
        <CxcCards
          kpis={data.kpis}
          currency={currency}
          snapshotLabel={data.snapshotDateKey !== null ? `al ${formatSnapshotDate(data.snapshotDateKey)}` : undefined}
        />
      </section>
      <SalesReturnsChart rows={data.monthlyTrend} trendMode={data.trendMode} currency={currency} />
    </div>
  );
}
