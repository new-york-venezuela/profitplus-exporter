'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import type { Currency, DateRange, FinanzasResponse, FinanzasWaterfallStep } from '../types';

const POSITIVE_COLOR = '#16a34a'; // green — revenue / profit steps
const NEGATIVE_COLOR = '#dc2626'; // red — cost / discount steps

function money(n: number, currency: Currency = 'bs', rate?: number): string {
  if (currency === 'usd' && rate) {
    n = n / rate;
  }
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

function moneyLabel(n: number, currency: Currency, rate?: number): string {
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(n, currency, rate)}`;
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

// Waterfall rendering: every step's own {amount, cumulative} pair is enough to
// derive its bar's floating range — no need to look at neighboring steps.
// `previousValue` is the level the bar starts from (cumulative minus this
// step's own delta); the bar then spans up to `cumulative`. For the anchor
// steps (Bruto, Neto, Utilidad Bruta) amount === cumulative, so previousValue
// is 0 and the bar is a full column from the axis; for the delta steps
// (Descuento, COGS) it floats between the two surrounding totals.
interface WaterfallDatum {
  step: string;
  base: number;
  value: number;
  amount: number;
  cumulative: number;
  isNegative: boolean;
}

function toWaterfallData(waterfall: FinanzasWaterfallStep[]): WaterfallDatum[] {
  return waterfall.map(w => {
    const previousValue = w.cumulative - w.amount;
    const base = Math.min(previousValue, w.cumulative);
    const value = Math.abs(w.amount);
    return {
      step: w.step,
      base,
      value,
      amount: w.amount,
      cumulative: w.cumulative,
      isNegative: w.amount < 0,
    };
  });
}

function WaterfallTooltip({
  active,
  payload,
  currency,
  rate,
}: {
  active?: boolean;
  payload?: Array<{ payload: WaterfallDatum }>;
  currency: Currency;
  rate?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.step}</p>
      <p className="text-gray-600">
        Monto: <span className="font-medium text-gray-900">{moneyLabel(d.amount, currency, rate)}</span>
      </p>
      <p className="text-gray-600">
        Acumulado: <span className="font-medium text-gray-900">{moneyLabel(d.cumulative, currency, rate)}</span>
      </p>
    </div>
  );
}

export default function TabFinanzas({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<FinanzasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/dwh/finanzas?dateRange=${dateRange}&currency=${currency}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: FinanzasResponse = await res.json();
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
  }, [dateRange, currency]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState />
      </div>
    );
  }

  const rate = data.usdRate ?? undefined;
  const chartData = toWaterfallData(data.waterfall);

  const bruto = data.waterfall.find(w => w.step === 'Bruto')?.cumulative ?? 0;
  const descuento = data.waterfall.find(w => w.step === 'Descuento');
  const neto = data.waterfall.find(w => w.step === 'Neto')?.cumulative ?? 0;
  const utilidad = data.waterfall.find(w => w.step === 'Utilidad Bruta')?.cumulative ?? 0;

  const discountRate = bruto > 0 && descuento ? Math.abs(descuento.amount) / bruto : null;
  const marginRate = neto > 0 ? utilidad / neto : null;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ventas brutas" value={moneyLabel(bruto, currency, rate)} />
        <KpiCard label="Ventas netas" value={moneyLabel(neto, currency, rate)} />
        <KpiCard label="Utilidad bruta" value={moneyLabel(utilidad, currency, rate)} />
        <KpiCard
          label="Margen bruto"
          value={pct(marginRate)}
          tone={marginRate !== null && marginRate < 0 ? 'warn' : 'default'}
        />
      </div>

      <ChartCard
        title="Cascada de rentabilidad"
        subtitle={`Bruto → Descuento → Neto → COGS → Utilidad bruta${
          discountRate !== null ? ` — descuento promedio ${pct(discountRate)}` : ''
        }`}
      >
        {chartData.length === 0 || bruto === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="step" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(Number(v), currency, rate)} />
              <Tooltip content={<WaterfallTooltip currency={currency} rate={rate} />} />
              {/* Invisible spacer bar that lifts the visible bar to its floating start point */}
              <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {chartData.map(d => (
                  <Cell key={d.step} fill={d.isNegative ? NEGATIVE_COLOR : POSITIVE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
