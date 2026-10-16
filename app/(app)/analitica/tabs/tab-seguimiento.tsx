'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import type { RootKind, SeguimientoExcludedInvoice, SeguimientoInvoiceLine, SeguimientoResponse, SeguimientoRoot } from '@/lib/seguimiento/types';
import { KpiCard } from '../components/kpi-card';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField, type SellerTargetRow } from '../components/quota-editor';
import { addDuals, monthLabel, pct, units } from '../components/seguimiento/fmt';
import { CustomerList, overdueLabel, RootCard, RootTable } from '../components/seguimiento/root-views';
import { GoalKpiCard } from '../components/seguimiento/goal-kpi-card';
import { MonthPaceStrip, QuotaBar, UnitsBar } from '../components/seguimiento/visuals';
import { moneyLabel, priceLabel } from '../lib/format';
import type { Currency, DateRange } from '../types';
import SellerProfile from './seller-profile';

const KIND_OPTIONS: { value: RootKind; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ruta', label: 'Ruta' },
  { value: 'grupo', label: 'Grupo de cliente' },
];

type View = 'cards' | 'table';
interface LinesState { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] }
interface ExcludedState { loading: boolean; error: string | null; invoices: SeguimientoExcludedInvoice[] }

function ToggleGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
      {options.map(o => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${value === o.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TabSeguimiento({ dateRange, currency }: { dateRange: DateRange; currency: Currency }) {
  const [kind, setKind] = useState<RootKind>('vendedor');
  const [view, setView] = useState<View>('cards');
  const [data, setData] = useState<SeguimientoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [expandedRoot, setExpandedRoot] = useState<string | null>(null);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [linesByCustomer, setLinesByCustomer] = useState<Record<string, LinesState>>({});
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [excludedFor, setExcludedFor] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<ExcludedState>({ loading: false, error: null, invoices: [] });
  const [editingMetas, setEditingMetas] = useState<string | null>(null);
  // Targets saved since the last load, keyed by `${month}:${salesRepKey}`. The quota POST is a
  // delete-then-reinsert upsert that needs the full three-field row, and root.targets only
  // refreshes once the post-save refetch returns: without this overlay a second save made
  // before then would write the first field back to its old value. Cleared on every load.
  const [savedTargets, setSavedTargets] = useState<Record<string, SellerTargetRow>>({});
  const savedTargetsRef = useRef<Record<string, SellerTargetRow>>({});
  // Bumped whenever the main load starts; a drill-down response from an older generation
  // (previous kind / date range / reload) is dropped instead of written into fresh state.
  const generationRef = useRef(0);
  // Only the latest excluded-invoices request may write its result.
  const excludedRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    generationRef.current += 1;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ kind, dateRange });
        // After a quota save the 15-minute private cache would serve the pre-save response.
        const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`, reloadToken > 0 ? { cache: 'no-store' } : undefined);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: SeguimientoResponse = await res.json();
        if (cancelled) return;
        setData(body);
        setExpandedRoot(null);
        setOpenCustomer(null);
        setLinesByCustomer({});
        setExcludedFor(null);
        excludedRequestRef.current += 1;
        // Fresh targets came with this response (it started after any completed save).
        savedTargetsRef.current = {};
        setSavedTargets({});
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [kind, dateRange, reloadToken]);

  const changeKind = (next: RootKind) => {
    posthog.capture('seguimiento_root_changed', { kind: next });
    setKind(next);
  };
  const changeView = (next: View) => {
    posthog.capture('seguimiento_view_changed', { view: next });
    setView(next);
  };

  async function openCustomerLines(code: string) {
    if (openCustomer === code) { setOpenCustomer(null); return; }
    setOpenCustomer(code);
    if (linesByCustomer[code]) return;
    const generation = generationRef.current;
    const write = (state: LinesState) => {
      if (generation !== generationRef.current) return;   // stale: kind/date range changed meanwhile
      setLinesByCustomer(prev => ({ ...prev, [code]: state }));
    };
    write({ loading: true, error: null, lines: [] });
    try {
      // The lines section only depends on the customer and the month, not on the grouping kind.
      const params = new URLSearchParams({ section: 'lines', customerCode: code, dateRange });
      const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`);
      if (!res.ok) throw new Error('lines');
      const body: { lines: SeguimientoInvoiceLine[] } = await res.json();
      write({ loading: false, error: null, lines: body.lines });
    } catch {
      write({ loading: false, error: 'No se pudieron cargar las facturas', lines: [] });
    }
  }

  async function toggleExcluded(root: SeguimientoRoot) {
    const request = ++excludedRequestRef.current;
    if (excludedFor === root.value) { setExcludedFor(null); return; }
    setExcludedFor(root.value);
    setExcluded({ loading: true, error: null, invoices: [] });
    const write = (state: ExcludedState) => {
      if (request === excludedRequestRef.current) setExcluded(state);
    };
    try {
      const params = new URLSearchParams({ section: 'excluded', kind, rootValue: root.value, dateRange });
      const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`);
      if (!res.ok) throw new Error('excluded');
      const body: { invoices?: SeguimientoExcludedInvoice[] } = await res.json();
      write({ loading: false, error: null, invoices: body.invoices ?? [] });
    } catch {
      write({ loading: false, error: 'No se pudieron cargar las facturas excluidas', invoices: [] });
    }
  }

  if (selectedSeller) {
    return (
      <SellerProfile
        salesRepKey={selectedSeller}
        dateRange={dateRange}
        currency={currency}
        onBack={() => setSelectedSeller(null)}
        backLabel="Volver a Seguimiento"
      />
    );
  }

  if (loading && !data && !error) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;

  const toggles = (
    <div className="flex items-center gap-3 flex-wrap">
      <ToggleGroup label="Agrupar por" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
      <ToggleGroup<View> label="Vista" value={view} options={[{ value: 'cards', label: 'Tarjetas' }, { value: 'table', label: 'Tabla' }]} onChange={changeView} />
    </div>
  );
  // The error renders under the header and toggles, so a grouping that fails can be switched away from.
  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900">Seguimiento de ventas</h2>
          {toggles}
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>}
      </div>
    );
  }

  const currentWeekIdx = data.weeks.reduce((last, w, i) => (w.isFuture ? last : i), -1);
  const currentWeek = currentWeekIdx >= 0 ? data.total.weeks[currentWeekIdx] : null;
  const total = data.total;
  const rootsWithExcluded = data.roots.filter(r => r.excludedSales.bs > 0);
  const hasConsignment = rootsWithExcluded.length > 0;

  const targetsKey = (root: SeguimientoRoot) => `${data.month}:${root.salesRepKey}`;
  const targetsOf = (root: SeguimientoRoot): SellerTargetRow => savedTargets[targetsKey(root)] ?? root.targets ?? EMPTY_TARGET_ROW;

  const saveField = async (root: SeguimientoRoot, field: keyof SellerTargetRow, value: number) => {
    if (!root.salesRepKey) return false;
    const key = targetsKey(root);
    // Read the ref, not render state: two saves can be in flight before React re-renders.
    const current = savedTargetsRef.current[key] ?? root.targets ?? EMPTY_TARGET_ROW;
    const ok = await saveSellerTargetField({ salesRepKey: root.salesRepKey, periodMonth: data.month, current, field, value });
    if (ok) {
      const next = { ...current, [field]: value };
      savedTargetsRef.current = { ...savedTargetsRef.current, [key]: next };
      setSavedTargets(savedTargetsRef.current);
      setReloadToken(t => t + 1);
    }
    return ok;
  };

  const customersOf = (root: SeguimientoRoot) => (
    <CustomerList
      customers={root.customers}
      headers={data.weeks}
      visibleLines={data.visibleLines}
      currency={currency}
      openCustomer={openCustomer}
      onOpenCustomer={openCustomerLines}
      linesFor={code => linesByCustomer[code] ?? { loading: true, error: null, lines: [] }}
    />
  );

  return (
    <div className="p-6 max-w-7xl space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Seguimiento de ventas</h2>
          <p className="text-xs text-gray-500">
            {monthLabel(data.month)} · al {data.asOf}. Ventas brutas sin IVA; la consignación a nivel de cadena (varios vendedores) se muestra aparte; meta y proyección del mes.
          </p>
          <div className="mt-1"><MonthPaceStrip pace={data.pace} /></div>
        </div>
        {toggles}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GoalKpiCard
          label="Ventas brutas"
          value={moneyLabel(total.sales, currency)}
          bar={<QuotaBar actual={total.sales} quotaUsd={total.salesQuotaUsd} projected={total.projected} currency={currency} partial={total.quotaPartial} />}
          notes={[
            total.avgPrice ? `Precio prom. ${priceLabel(total.avgPrice, currency)}` : null,
            hasConsignment ? `Con consignación: ${moneyLabel(addDuals(total.sales, total.excludedSales), currency)}` : null,
            hasConsignment && total.projectedWithConsignment ? `Proyección con consignación: ${moneyLabel(total.projectedWithConsignment, currency)}` : null,
          ]}
        />
        <GoalKpiCard
          label="Unidades vendidas"
          value={units(total.units)}
          bar={<UnitsBar actual={total.units} quota={total.unitsQuota ?? null} projected={total.projectedUnits ?? null} partial={total.unitsQuotaPartial ?? false} />}
          notes={[
            hasConsignment && total.unitsWithConsignment != null ? `Con consignación: ${units(total.unitsWithConsignment)}` : null,
            hasConsignment && total.projectedUnitsWithConsignment != null ? `Proyección con consignación: ${units(total.projectedUnitsWithConsignment)}` : null,
          ]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Clientes activos (semana actual)"
          value={currentWeek && currentWeek.pct !== null ? pct(currentWeek.pct) : '—'}
          subtitle={currentWeek ? `${currentWeek.active} de ${currentWeek.assigned}` : undefined}
        />
        <KpiCard
          label="Nuevos clientes"
          value={`${total.newCustomers.count}${total.newCustomers.quota === null ? '' : ` / ${total.newCustomers.quota}`}`}
          subtitle={total.newCustomers.quota === null ? 'Sin meta' : `${pct(total.newCustomers.quota > 0 ? total.newCustomers.count / total.newCustomers.quota : null)} de la meta`}
        />
        <KpiCard label="Visitas vencidas" value={overdueLabel(total)} />
      </div>

      {data.roots.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos para este mes.</div>
      ) : view === 'table' ? (
        <RootTable
          roots={data.roots} total={total} headers={data.weeks} currency={currency}
          expandedValue={expandedRoot} onToggle={v => setExpandedRoot(expandedRoot === v ? null : v)}
          renderExpanded={customersOf}
        />
      ) : (
        <div className="space-y-3">
          {data.roots.map(root => (
            <RootCard
              key={root.value}
              title={root.label}
              subtitle={kind === 'vendedor' ? undefined : root.sellerKeys.length > 1 ? `${root.sellerKeys.length} vendedores` : undefined}
              metrics={root}
              goalsNote={kind === 'vendedor' ? undefined : 'Las metas se definen por vendedor'}
              headers={data.weeks}
              visibleLines={data.visibleLines}
              currency={currency}
              expanded={expandedRoot === root.value}
              onToggle={() => setExpandedRoot(expandedRoot === root.value ? null : root.value)}
              actions={root.salesRepKey ? (
                <>
                  <button onClick={() => setSelectedSeller(root.salesRepKey)} className="text-xs text-blue-600 hover:underline">Ver perfil</button>
                  <button onClick={() => setEditingMetas(editingMetas === root.value ? null : root.value)} className="text-xs text-blue-600 hover:underline">Editar metas</button>
                </>
              ) : undefined}
              footer={root.salesRepKey && editingMetas === root.value ? (
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 border-t border-gray-100 pt-2">
                  <span>Ventas: <QuotaEditor currentValue={targetsOf(root).salesQuotaUsd} field="salesQuotaUsd" suffix="USD" onSave={(f, v) => saveField(root, f, v)} /></span>
                  <span>Visitas por semana: <QuotaEditor currentValue={targetsOf(root).weeklyVisitQuota} field="weeklyVisitQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
                  <span>Clientes nuevos: <QuotaEditor currentValue={targetsOf(root).newCustomerQuota} field="newCustomerQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
                  <span>Unidades: <QuotaEditor currentValue={targetsOf(root).unitsQuota} field="unitsQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
                </div>
              ) : undefined}
            >
              {customersOf(root)}
            </RootCard>
          ))}
        </div>
      )}

      {rootsWithExcluded.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Facturas excluidas — patrón de consignación</h3>
          <p className="text-xs text-gray-500 mb-3">
            Facturas emitidas de forma agregada a nivel de cadena (no por tienda): no es posible atribuir de forma confiable qué
            vendedor generó la venta. No se suman a las ventas por vendedor, la meta ni la activación de arriba en vez de estimarse; se muestran como «Con consignación» en Ventas brutas y en la proyección.
          </p>
          <ul className="space-y-2">
            {rootsWithExcluded.map(root => (
              <li key={root.value} className="text-sm">
                <button onClick={() => toggleExcluded(root)} aria-expanded={excludedFor === root.value} className="text-amber-700 hover:text-amber-900 underline">
                  {root.label}: {moneyLabel(root.excludedSales, currency)} excluidos
                </button>
                {excludedFor === root.value && (
                  <div className="mt-2 ml-4 text-xs">
                    {excluded.loading ? <div className="text-gray-400 py-1">Cargando…</div>
                      : excluded.error ? <div className="text-red-600 py-1">{excluded.error}</div>
                      : excluded.invoices.length === 0 ? <div className="text-gray-400 py-1">Sin facturas.</div>
                      : (
                        <table className="min-w-full">
                          <thead><tr className="text-gray-500"><th className="text-left pr-4 py-1">Cliente</th><th className="text-left pr-4 py-1">Factura</th><th className="text-left pr-4 py-1">Fecha</th><th className="text-right py-1">Monto</th></tr></thead>
                          <tbody>
                            {excluded.invoices.map(inv => (
                              <tr key={inv.invoiceNumber} className="text-gray-700">
                                <td className="pr-4 py-1">{inv.customerName}</td><td className="pr-4 py-1">{inv.invoiceNumber}</td>
                                <td className="pr-4 py-1">{inv.invoiceDate}</td><td className="text-right py-1">{moneyLabel(inv.amountNet, currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
