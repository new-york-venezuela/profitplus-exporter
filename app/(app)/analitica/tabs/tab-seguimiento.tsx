'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import type { RootKind, SeguimientoExcludedInvoice, SeguimientoInvoiceLine, SeguimientoResponse, SeguimientoRoot } from '@/lib/seguimiento/types';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField, type SellerTargetRow } from '../components/quota-editor';
import { ExcludedSection, type ExcludedState } from '../components/seguimiento/excluded-section';
import { monthLabel } from '../components/seguimiento/fmt';
import { NewCustomersTable } from '../components/seguimiento/new-customers-section';
import { CustomerList } from '../components/seguimiento/root-views';
import { SellerGrid } from '../components/seguimiento/seller-grid';
import { MonthPaceStrip } from '../components/seguimiento/visuals';
import { WeeklyMatrix } from '../components/seguimiento/weekly-matrix';
import type { Currency, DateRange } from '../types';
import SellerProfile from './seller-profile';

const KIND_OPTIONS: { value: RootKind; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ruta', label: 'Ruta' },
  { value: 'grupo', label: 'Grupo de cliente' },
];

interface LinesState { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] }

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
  const [data, setData] = useState<SeguimientoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [linesByCustomer, setLinesByCustomer] = useState<Record<string, LinesState>>({});
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [excludedFor, setExcludedFor] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<ExcludedState>({ loading: false, error: null, invoices: [] });
  const [editingMetas, setEditingMetas] = useState<string | null>(null);
  // Targets saved since the last load, keyed by `${month}:${salesRepKey}`. The quota POST is a
  // delete-then-reinsert upsert that needs the full row, and root.targets only refreshes once the
  // post-save refetch returns: without this overlay a second save made before then would write the
  // first field back to its old value. Cleared on every load.
  const [savedTargets, setSavedTargets] = useState<Record<string, SellerTargetRow>>({});
  const savedTargetsRef = useRef<Record<string, SellerTargetRow>>({});
  // Bumped whenever the main load starts; a drill-down response from an older generation
  // (previous kind / date range / reload) is dropped instead of written into fresh state.
  const generationRef = useRef(0);
  // Only the latest excluded-invoices request may write its result.
  const excludedRequestRef = useRef(0);
  // kind|dateRange of the data on screen: a reload of the same grouping (after a quota save) keeps the selection.
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    generationRef.current += 1;
    const key = `${kind}|${dateRange}`;
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
        const sameGrouping = loadedKeyRef.current === key;
        loadedKeyRef.current = key;
        setData(body);
        setSelected(prev => (sameGrouping && prev !== null && body.roots.some(r => r.value === prev) ? prev : null));
        if (!sameGrouping) setEditingMetas(null);
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

  const selectRoot = (value: string) => {
    setOpenCustomer(null);
    if (selected === value) { setSelected(null); return; }
    posthog.capture('seguimiento_root_selected', { kind });
    setSelected(value);
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

  const toggles = <ToggleGroup label="Agrupar por" value={kind} options={KIND_OPTIONS} onChange={changeKind} />;
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

  const root = selected === null ? null : data.roots.find(r => r.value === selected) ?? null;
  const targetsKey = (r: SeguimientoRoot) => `${data.month}:${r.salesRepKey}`;
  const targetsOf = (r: SeguimientoRoot): SellerTargetRow => savedTargets[targetsKey(r)] ?? r.targets ?? EMPTY_TARGET_ROW;

  const saveField = async (r: SeguimientoRoot, field: keyof SellerTargetRow, value: number) => {
    if (!r.salesRepKey) return false;
    const key = targetsKey(r);
    // Read the ref, not render state: two saves can be in flight before React re-renders.
    const current = savedTargetsRef.current[key] ?? r.targets ?? EMPTY_TARGET_ROW;
    const ok = await saveSellerTargetField({ salesRepKey: r.salesRepKey, periodMonth: data.month, current, field, value });
    if (ok) {
      const next = { ...current, [field]: value };
      savedTargetsRef.current = { ...savedTargetsRef.current, [key]: next };
      setSavedTargets(savedTargetsRef.current);
      setReloadToken(t => t + 1);
    }
    return ok;
  };

  const subtitleOf = (r: SeguimientoRoot) => [
    `${r.customerCount} clientes`,
    kind === 'vendedor' ? r.routeLabels.join(', ') : r.sellerKeys.length > 1 ? `${r.sellerKeys.length} vendedores` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="p-6 max-w-7xl space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Seguimiento de ventas</h2>
          <p className="text-xs text-gray-500">
            {monthLabel(data.month)} · al {data.asOf}. Ventas sin IVA; metas y estado contra las brutas proyectadas al cierre del mes; la consignación a nivel de cadena se muestra aparte.
          </p>
          <div className="mt-1"><MonthPaceStrip pace={data.pace} /></div>
        </div>
        {toggles}
      </div>

      {data.roots.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Sin datos para este mes.</div>
      ) : (
        <SellerGrid roots={data.roots} total={data.total} kind={kind} currency={currency} selected={selected} onSelect={selectRoot} />
      )}

      <ExcludedSection
        roots={data.roots.filter(r => r.excludedSales.bs > 0)}
        currency={currency}
        openFor={excludedFor}
        state={excluded}
        onToggle={toggleExcluded}
      />

      {root && (
        <section aria-label={`Detalle de ${root.label}`} className="bg-white border border-gray-200 rounded-lg p-4 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{root.label}</h3>
              <p className="text-xs text-gray-500">{subtitleOf(root)}</p>
            </div>
            {root.salesRepKey && (
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedSeller(root.salesRepKey)} className="text-xs text-blue-600 hover:underline">Ver perfil</button>
                <button onClick={() => setEditingMetas(editingMetas === root.value ? null : root.value)} className="text-xs text-blue-600 hover:underline">Editar metas</button>
              </div>
            )}
          </div>
          {root.salesRepKey && editingMetas === root.value && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 border-y border-gray-100 py-2">
              <span>Ventas: <QuotaEditor currentValue={targetsOf(root).salesQuotaUsd} field="salesQuotaUsd" suffix="USD" onSave={(f, v) => saveField(root, f, v)} /></span>
              <span>Visitas por semana: <QuotaEditor currentValue={targetsOf(root).weeklyVisitQuota} field="weeklyVisitQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
              <span>Clientes nuevos: <QuotaEditor currentValue={targetsOf(root).newCustomerQuota} field="newCustomerQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
              <span>Unidades: <QuotaEditor currentValue={targetsOf(root).unitsQuota} field="unitsQuota" onSave={(f, v) => saveField(root, f, v)} /></span>
            </div>
          )}
          <WeeklyMatrix root={root} headers={data.weeks} currency={currency} />
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Clientes nuevos</h4>
            <NewCustomersTable customers={root.customers} currency={currency} monthLabel={monthLabel(data.month)} />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Clientes</h4>
            <CustomerList
              customers={root.customers}
              headers={data.weeks}
              visibleLines={data.visibleLines}
              currency={currency}
              openCustomer={openCustomer}
              onOpenCustomer={openCustomerLines}
              linesFor={code => linesByCustomer[code] ?? { loading: true, error: null, lines: [] }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
