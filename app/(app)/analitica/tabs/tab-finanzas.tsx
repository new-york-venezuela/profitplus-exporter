'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import { money, moneyLabel } from '../lib/format';
import type {
  BreakdownRow, Currency, DateRange, FinanzasResponse, PivotDimension,
} from '../types';

const POSITIVE_COLOR = '#16a34a'; // green — revenue / profit steps
const NEGATIVE_COLOR = '#dc2626'; // red — cost / discount steps

// Not labeled "EBITDA" — investigated 2026-09-14 whether Gastos Operativos
// could be split by cost center (to isolate production cost, a prerequisite
// for a real EBITDA/margin figure) and found the source data can't support
// it for Nomina specifically (see docs/DATA_WAREHOUSE_GUIDE.md's Cost Data
// Gap section) — concept-name keywords cover only 6.6% of Nomina volume by
// amount. So this is a real operating margin, not EBITDA: it does not
// isolate production payroll from admin/sales payroll, on top of the
// pre-existing D&A gap. As of 2026-09-15 the calc itself moved to accrual
// sources (Fact_Sales/Fact_Returns for income, Fact_Purchases + non-payroll
// cash-ledger categories for expense — see docs/superpowers/specs/
// 2026-09-15-margen-operativo-accrual-design.md) instead of the pure
// cash-ledger calc this tooltip used to describe.
const MARGIN_TOOLTIP = 'Ingresos netos (ventas menos devoluciones) menos gastos operativos (compras más nómina y otros gastos desde movimientos bancarios/caja). No aísla la nómina de producción (~93% de la nómina no tiene centro de costo identificable en el origen) ni incluye ajuste por depreciación/amortización.';

const PROXY_TOOLTIP = 'Utilidad Bruta (proxy) = Ingresos operativos − Compras. Profit Plus no registra costo de producto (Fact_Sales.GrossProfitAmount siempre es NULL), así que Compras se usa como aproximación de costo directo — no es un margen bruto exacto basado en COGS real. Distinto de Margen Operativo, que resta TODOS los gastos operativos, no solo Compras.';

// This table has no top-level groupBy toggle — rows are always one-per-expense-
// category. GroupedDrilldownTable requires a groupBy/groupByOptions pair, so
// it's fixed to a single no-op option, same pattern as tab-vendedores.tsx.
// `PivotDimension` has no member that semantically means "category"/"concepto"
// (it's shared by the Cliente/Producto/Vendedor pivot mechanism) — reusing
// 'producto' as a sentinel here mirrors the already-shipped línea→producto
// precedent in tab-ventas.tsx (LINEA_GROUP_BY_OPTIONS/LINEA_BREAKDOWN_BY_OPTIONS).
const CATEGORY_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Categoría' },
];

const CATEGORY_BREAKDOWN_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Concepto' },
];

interface CategoryTableRow {
  label: string;
  value: string;
  amount: number;
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

interface WaterfallDatum {
  step: string;
  base: number;
  value: number;
  amount: number;
  cumulative: number;
  isNegative: boolean;
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
  const [categoryBreakdownBy, setCategoryBreakdownBy] = useState<PivotDimension | null>(null);

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
  const margenProxy = data.margenProxy;

  const proxyWaterfallData: WaterfallDatum[] = [
    { step: 'Ingresos', base: 0, value: margenProxy.ingresos, amount: margenProxy.ingresos, cumulative: margenProxy.ingresos, isNegative: false },
    {
      step: 'Compras',
      base: Math.min(margenProxy.utilidadBruta, margenProxy.ingresos),
      value: margenProxy.compras,
      amount: -margenProxy.compras,
      cumulative: margenProxy.utilidadBruta,
      isNegative: true,
    },
    { step: 'Utilidad Bruta', base: 0, value: margenProxy.utilidadBruta, amount: margenProxy.utilidadBruta, cumulative: margenProxy.utilidadBruta, isNegative: margenProxy.utilidadBruta < 0 },
    {
      step: 'Otros Gastos Operativos',
      base: Math.min(margenProxy.margenOperativo, margenProxy.utilidadBruta),
      value: Math.abs(margenProxy.otrosGastosOperativos),
      amount: -margenProxy.otrosGastosOperativos,
      cumulative: margenProxy.margenOperativo,
      isNegative: margenProxy.otrosGastosOperativos >= 0,
    },
    { step: 'Margen Operativo', base: 0, value: margenProxy.margenOperativo, amount: margenProxy.margenOperativo, cumulative: margenProxy.margenOperativo, isNegative: margenProxy.margenOperativo < 0 },
  ];

  async function handleFetchCategoryBreakdown(parentValue: string): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, breakdownBy: 'concepto', parentValue });
    const res = await fetch(`/api/dwh/finanzas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const categoryRows: CategoryTableRow[] = (data.expenseBreakdown ?? []).map(row => ({
    label: row.category,
    value: row.category,
    amount: row.amount,
  }));

  const categoryColumns: DrilldownColumn<CategoryTableRow>[] = [
    { key: 'amount', label: 'Monto', align: 'right', format: row => moneyLabel(row.amount, currency, rate) },
  ];

  return (
    <div className="p-6 max-w-7xl space-y-6">
      {/* KPI row — Utilidad Bruta (proxy) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ingresos operativos" value={moneyLabel(margenProxy.ingresos, currency, rate)} />
        <KpiCard label="Compras" value={moneyLabel(margenProxy.compras, currency, rate)} />
        <KpiCard label="Utilidad bruta (proxy)" value={moneyLabel(margenProxy.utilidadBruta, currency, rate)} />
        <KpiCard
          label="Margen bruto (proxy)"
          value={pct(margenProxy.margenBrutoRate)}
          tone={margenProxy.margenBrutoRate !== null && margenProxy.margenBrutoRate < 0 ? 'warn' : 'default'}
        />
      </div>

      <p className="text-xs text-gray-500 flex items-center gap-1">
        <span title={PROXY_TOOLTIP} className="cursor-help text-gray-400">ⓘ</span>
        Compras se usa como proxy de costo directo — Profit Plus no registra costo de producto (ver Data Warehouse Guide).
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Margen Operativo</h2>
          <span title={MARGIN_TOOLTIP} className="cursor-help text-xs text-gray-400">ⓘ</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Ingresos operativos" value={moneyLabel(data.cashFlowEbitda.ingresosOperativos, currency, rate)} />
          <KpiCard label="Gastos operativos" value={moneyLabel(data.cashFlowEbitda.gastosOperativos, currency, rate)} />
          <KpiCard label="Margen Operativo" value={moneyLabel(data.cashFlowEbitda.ebitda, currency, rate)} />
          <KpiCard
            label="Margen Operativo %"
            value={pct(margenProxy.margenOperativoRate)}
            tone={margenProxy.margenOperativoRate !== null && margenProxy.margenOperativoRate < 0 ? 'warn' : 'default'}
          />
          <KpiCard label="Intereses" value={moneyLabel(data.cashFlowEbitda.intereses, currency, rate)} />
          <KpiCard label="Impuestos" value={moneyLabel(data.cashFlowEbitda.impuestos, currency, rate)} />
          <KpiCard
            label="Utilidad neta"
            value={moneyLabel(data.cashFlowEbitda.utilidadNeta, currency, rate)}
            tone={data.cashFlowEbitda.utilidadNeta < 0 ? 'warn' : 'default'}
          />
        </div>
      </div>

      <ChartCard
        title="Cascada de rentabilidad (proxy)"
        subtitle={`Ingresos → Compras → Utilidad Bruta → Otros Gastos Operativos → Margen Operativo — margen bruto ${pct(margenProxy.margenBrutoRate)}, margen operativo ${pct(margenProxy.margenOperativoRate)}`}
      >
        {margenProxy.ingresos === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={proxyWaterfallData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="step" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(Number(v), currency, rate)} />
              <Tooltip content={<WaterfallTooltip currency={currency} rate={rate} />} />
              <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {proxyWaterfallData.map(d => (
                  <Cell key={d.step} fill={d.isNegative ? NEGATIVE_COLOR : POSITIVE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-900">Gastos operativos por categoría</h2>
        <p className="text-xs text-gray-500 mb-3">
          Desglose de egresos operativos por categoría, con detalle por concepto (o por proveedor en Compras)
        </p>
        {categoryRows.length === 0 ? (
          <EmptyState />
        ) : (
          <GroupedDrilldownTable<CategoryTableRow>
            rows={categoryRows}
            columns={categoryColumns}
            groupByOptions={CATEGORY_GROUP_BY_OPTIONS}
            groupBy="producto"
            onGroupByChange={() => {}}
            breakdownByOptions={CATEGORY_BREAKDOWN_OPTIONS}
            breakdownBy={categoryBreakdownBy}
            onBreakdownByChange={setCategoryBreakdownBy}
            onFetchBreakdown={parentValue => handleFetchCategoryBreakdown(parentValue)}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
          />
        )}
      </div>
    </div>
  );
}
