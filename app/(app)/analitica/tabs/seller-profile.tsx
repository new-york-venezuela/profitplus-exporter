'use client';

import { useEffect, useState } from 'react';
import { moneyLabel } from '../lib/format';
import type { Currency, DateRange, Seller360Response } from '../types';

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

// Which month a quota edit made "now" attributes to: the LATEST month in the
// currently-selected date range — same months[months.length - 1] logic
// vendedor-360/route.ts's own resolveDateBounds/monthsInRange already use
// server-side for latestMonthRow (Activación's weekly quota). Re-derived
// independently here (not imported — app/(app) code doesn't import from
// app/api/*, this app's existing layering convention) since multi-month
// quota editing isn't required by the spec, just single current-month entry.
function resolveLatestPeriodMonth(dateRange: DateRange): string {
  const customMatch = /^custom:\d{4}-\d{2}-\d{2}:(\d{4})-(\d{2})-\d{2}$/.exec(dateRange);
  if (customMatch) return `${customMatch[1]}-${customMatch[2]}`;

  const monthMatch = /^month:(\d{4})-(\d{2})$/.exec(dateRange);
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;

  const ytdMatch = /^ytd:(\d{4})$/.exec(dateRange);
  if (ytdMatch) {
    const currentYear = new Date().getUTCFullYear();
    return ytdMatch[1] === String(currentYear)
      ? new Date().toISOString().slice(0, 7)
      : `${ytdMatch[1]}-12`;
  }

  // '12m' (and any other/legacy value) defaults to a trailing-365-day
  // window ending today, same as resolveDateBounds's own fallback.
  return new Date().toISOString().slice(0, 7);
}

interface SellerTargetRow {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
}

const EMPTY_TARGET_ROW: SellerTargetRow = { salesQuotaUsd: null, weeklyVisitQuota: null, newCustomerQuota: null };

// Inline click-to-edit quota affordance, same pattern as tab-cadencia.tsx's
// targetGapDays editor: a value/"Definir" link swaps to a number input +
// "Guardar" button, then calls onSave (SellerProfile's saveQuotaField),
// which persists the change and triggers a profile refetch so the new quota
// is reflected immediately.
//
// `currentValue` (sourced from the seller_targets row for the profile's
// latest-in-range
// periodMonth, fetched once by SellerProfile and shared by all three
// editors below) is the pre-fill/display source for this editor's OWN
// field — NOT the parent Seller360Response's `quotaUsd`/`quota` props,
// which are a SUM across every month in the selected range (see
// quota-resolution.ts's resolveQuotaSum) and only equal one month's row
// when the range is itself a single month. This also matters for SAVING:
// POST /api/admin/seller-targets is a delete-then-reinsert upsert (see
// app/api/admin/seller-targets/route.ts) — any quota field omitted from the
// POST body is written back as null, so saving just this one field without
// the other two current values would silently wipe them. onSave (passed by
// SellerProfile) always sends the full three-field row, only overriding the
// one field this editor owns.
function QuotaEditor({
  currentValue, field, suffix = '', onSave,
}: {
  currentValue: number | null;
  field: keyof SellerTargetRow;
  suffix?: string;
  onSave: (field: keyof SellerTargetRow, newValue: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ok = await onSave(field, parsed);
      if (ok) setEditing(false);
      else setSaveError('No se pudo guardar la meta');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 print:hidden">
        <input
          type="number"
          min={0}
          step="any"
          autoFocus
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="border border-gray-200 rounded px-1 py-0.5 w-20 text-right text-xs"
        />
        <button disabled={saving} onClick={save} className="text-blue-600 hover:text-blue-800 text-xs">
          Guardar
        </button>
        <button disabled={saving} onClick={() => { setEditing(false); setSaveError(null); }} className="text-gray-400 hover:text-gray-600 text-xs">
          Cancelar
        </button>
        {saveError && <span className="text-red-600 text-xs">{saveError}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => { setEditing(true); setInputValue(currentValue === null ? '' : String(currentValue)); }}
      className="text-xs text-blue-600 hover:underline print:hidden"
    >
      {currentValue === null ? `Definir meta${suffix ? ` (${suffix})` : ''}` : `Editar meta (${currentValue}${suffix})`}
    </button>
  );
}

function attainmentBadgeClass(actual: number, quota: number | null): string {
  if (quota === null || quota === 0) return 'bg-gray-100 text-gray-500';
  const ratio = actual / quota;
  if (ratio >= 1) return 'bg-green-100 text-green-800';
  if (ratio >= 0.8) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

// `actual` here MUST always be the value the attainment percentage is
// computed against (e.g. Cuota's USD sales figure vs. quotaUsd), never the
// currency-toggled DISPLAY value — `actualLabel` is purely presentational
// and can differ (Bs or USD) without affecting the badge/percentage math.
function KpiCard({ label, actual, actualLabel, quota, quotaSuffix = '' }: {
  label: string;
  actual: number;
  actualLabel: string;
  quota: number | null;
  quotaSuffix?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</h3>
      <div className="text-2xl font-bold text-gray-900">{actualLabel}</div>
      {quota === null ? (
        <div className="text-xs text-gray-400 mt-1">Sin meta definida</div>
      ) : (
        <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${attainmentBadgeClass(actual, quota)}`}>
          {pct(quota > 0 ? actual / quota : null)} de la meta ({quota}{quotaSuffix})
        </div>
      )}
    </div>
  );
}

export default function SellerProfile({ salesRepKey, dateRange, currency, onBack }: {
  salesRepKey: string;
  dateRange: DateRange;
  currency: Currency;
  onBack: () => void;
}) {
  const [data, setData] = useState<Seller360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityGrain, setEntityGrain] = useState<'entity' | 'tienda'>('entity');
  // Bumped after a successful quota save (see saveQuotaField below) to force
  // the load effect to refetch — a saved quota should be reflected on this
  // same profile view immediately, not only after a manual reload.
  const [reloadToken, setReloadToken] = useState(0);
  // The raw seller_targets row for the profile's latest-in-range
  // periodMonth — the single source of truth all three QuotaEditors below
  // read from and merge into on save (see QuotaEditor's comment for why this
  // can't be the parent Seller360Response's own quotaUsd/quota fields).
  const [targetRow, setTargetRow] = useState<SellerTargetRow>(EMPTY_TARGET_ROW);

  const periodMonth = resolveLatestPeriodMonth(dateRange);

  useEffect(() => {
    let cancelled = false;
    async function loadTargetRow() {
      try {
        const params = new URLSearchParams({ salesRepKey, periodMonth });
        const res = await fetch(`/api/admin/seller-targets?${params.toString()}`, { cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const row = await res.json();
          setTargetRow({
            salesQuotaUsd: typeof row?.salesQuotaUsd === 'number' ? row.salesQuotaUsd : null,
            weeklyVisitQuota: typeof row?.weeklyVisitQuota === 'number' ? row.weeklyVisitQuota : null,
            newCustomerQuota: typeof row?.newCustomerQuota === 'number' ? row.newCustomerQuota : null,
          });
        }
      } catch {
        // Non-fatal — the quota editors simply show "Definir meta" as if no
        // row existed yet; the rest of the profile is unaffected.
      }
    }
    loadTargetRow();
    return () => { cancelled = true; };
  }, [salesRepKey, periodMonth, reloadToken]);

  // Always POSTs the full three-field row (see QuotaEditor's comment on why
  // — the seller-targets route's upsert is delete-then-reinsert, so any
  // field left out of the body is written back as null).
  async function saveQuotaField(field: keyof SellerTargetRow, newValue: number): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/seller-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesRepKey, periodMonth, ...targetRow, [field]: newValue }),
      });
      if (!res.ok) return false;
      setTargetRow(prev => ({ ...prev, [field]: newValue }));
      setReloadToken(t => t + 1);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ salesRepKey, dateRange, entityGrain });
        // no-store: the route sends a 15-minute Cache-Control (shared by
        // every dwh/* route). Fine on a normal tab load, but this profile
        // also reloads right after a quota edit (see saveQuotaField above),
        // and a same-URL GET within that window would otherwise serve the
        // pre-save cached response — same reasoning as tab-cadencia.tsx's
        // own fetch.
        const res = await fetch(`/api/dwh/vendedor-360?${params.toString()}`, { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [salesRepKey, dateRange, entityGrain, reloadToken]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4 print:hidden">← Volver a Vendedores</button>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Volver a Vendedores</button>
        <button
          onClick={() => window.print()}
          className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700"
        >
          Imprimir / PDF
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">{data.salesRepName}</h1>
        <p className="text-sm text-gray-500">Período: {dateRange} — Generado: {new Date().toISOString().slice(0, 10)}</p>
      </div>

      <h1 className="text-lg font-bold text-gray-900 print:hidden">{data.salesRepName}</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900">1. Activación (alcance semanal)</h2>
          <select
            value={entityGrain}
            onChange={e => setEntityGrain(e.target.value === 'tienda' ? 'tienda' : 'entity')}
            className="text-xs border border-gray-300 rounded px-2 py-1 print:hidden"
          >
            <option value="entity">Por entidad</option>
            <option value="tienda">Por tienda</option>
          </select>
        </div>
        {data.activacion.weeks.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin ventas en el período.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Semana</th>
                <th className="text-right py-1">Clientes alcanzados</th>
              </tr>
            </thead>
            <tbody>
              {data.activacion.weeks.map(w => (
                <tr key={w.weekStart}>
                  <td className="pr-4 py-1">{w.weekStart}</td>
                  <td className="text-right py-1">{w.distinctReached}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center gap-2 mt-2">
          {data.activacion.weeklyVisitQuota === null ? (
            <div className="text-xs text-gray-400">Sin meta semanal definida</div>
          ) : (
            <div className="text-xs text-gray-600">Meta semanal: {data.activacion.weeklyVisitQuota} clientes</div>
          )}
          <QuotaEditor
            currentValue={targetRow.weeklyVisitQuota}
            field="weeklyVisitQuota"
            onSave={saveQuotaField}
          />
        </div>
      </div>

      <KpiCard
        label="2. Cuota de ventas mensual"
        actual={data.cuota.salesGross.usd ?? 0}
        actualLabel={moneyLabel(data.cuota.salesGross, currency)}
        quota={data.cuota.quotaUsd}
        quotaSuffix=" USD"
      />
      <div className="flex items-center gap-2 -mt-2">
        <QuotaEditor
          currentValue={targetRow.salesQuotaUsd}
          field="salesQuotaUsd"
          suffix="USD"
          onSave={saveQuotaField}
        />
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Ventas brutas sin IVA (antes de devoluciones), excluida la facturación de consignación — igual que la pestaña Vendedores.
      </p>
      {data.cuota.isPartial && (
        <p className="text-xs text-amber-700">Meta parcial: falta la meta de algún mes del rango seleccionado.</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">3. Cobranza (antigüedad de saldos)</h2>
        {data.cobranza.buckets.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin datos de antigüedad disponibles.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Rango</th>
                <th className="text-right pr-4 py-1">Este vendedor</th>
                <th className="text-right py-1">Total empresa</th>
              </tr>
            </thead>
            <tbody>
              {data.cobranza.buckets.map(b => {
                const baseline = data.cobranza.baselineBuckets.find(x => x.bucket === b.bucket);
                return (
                  <tr key={b.bucket}>
                    <td className="pr-4 py-1">{b.bucket}</td>
                    <td className="text-right pr-4 py-1">{moneyLabel(b.amount, currency)}</td>
                    <td className="text-right py-1 text-gray-400">{baseline ? moneyLabel(baseline.amount, currency) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <KpiCard
        label="4. Nuevos clientes"
        actual={data.nuevosClientes.rows.length}
        actualLabel={String(data.nuevosClientes.rows.length)}
        quota={data.nuevosClientes.quota}
      />
      <div className="flex items-center gap-2 -mt-2">
        <QuotaEditor
          currentValue={targetRow.newCustomerQuota}
          field="newCustomerQuota"
          onSave={saveQuotaField}
        />
      </div>
      {data.nuevosClientes.possiblyIncludesPreExistingCustomers && (
        <p className="text-xs text-amber-700">
          Nota: el histórico de ventas de este sistema comienza en {data.nuevosClientes.factSalesMinDate}
          {' '}— clientes con compras anteriores a esa fecha pueden aparecer como nuevos.
        </p>
      )}
      {data.nuevosClientes.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Cliente</th>
                <th className="pr-4 py-1">Primera venta</th>
                <th className="text-right py-1">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.nuevosClientes.rows.map(r => (
                <tr key={r.legalEntityKey}>
                  <td className="pr-4 py-1">{r.legalEntityName}</td>
                  <td className="pr-4 py-1">{r.firstSaleDate}</td>
                  <td className="text-right py-1">{moneyLabel(r.firstSaleAmount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">5. Clientes recuperados</h2>
        {data.clientesRecuperados.rows.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin clientes recuperados en el período.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pr-4 py-1">Cliente</th>
                <th className="pr-4 py-1">Última venta antes</th>
                <th className="text-right pr-4 py-1">Días</th>
                <th className="pr-4 py-1">Venta de recuperación</th>
                <th className="text-right py-1">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesRecuperados.rows.map(r => (
                <tr key={r.legalEntityKey}>
                  <td className="pr-4 py-1">{r.legalEntityName}</td>
                  <td className="pr-4 py-1">{r.lastSaleBeforeGap}</td>
                  <td className="text-right pr-4 py-1">{r.gapDays}</td>
                  <td className="pr-4 py-1">{r.recoverySaleDate}</td>
                  <td className="text-right py-1">{moneyLabel(r.recoverySaleAmount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-900 mb-2">6a. Devoluciones por producto <span className="font-normal text-gray-500">(por fecha de devolución)</span></h2>
          {data.devoluciones.byProduct.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin devoluciones.</div>
          ) : (
            <table className="min-w-full text-sm">
              <tbody>
                {data.devoluciones.byProduct.map(r => (
                  <tr key={r.label}>
                    <td className="pr-4 py-1">{r.label}</td>
                    <td className="text-right pr-4 py-1">{r.quantity}</td>
                    <td className="text-right py-1">{moneyLabel(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-900 mb-2">6b. Devoluciones por tienda <span className="font-normal text-gray-500">(por fecha de devolución)</span></h2>
          {data.devoluciones.byTienda.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin devoluciones.</div>
          ) : (
            <table className="min-w-full text-sm">
              <tbody>
                {data.devoluciones.byTienda.map(r => (
                  <tr key={r.label}>
                    <td className="pr-4 py-1">{r.label}</td>
                    <td className="text-right pr-4 py-1">{r.quantity}</td>
                    <td className="text-right py-1">{moneyLabel(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 mb-2">7. Profundidad de línea</h2>
        {data.profundidad.coverage === null ? (
          <div className="text-sm text-gray-400 py-4 text-center">Sin datos de cobertura para este vendedor en el período.</div>
        ) : (
          <div className="text-sm">
            <div>Cobertura propia: <strong>{pct(data.profundidad.coverage.ownPenetration)}</strong></div>
            <div className="text-gray-500">Línea base de la empresa: {pct(data.profundidad.coverage.baselinePenetration)}</div>
            <div className={data.profundidad.coverage.gapVsBaseline !== null && data.profundidad.coverage.gapVsBaseline < 0 ? 'text-red-600' : 'text-green-600'}>
              Diferencia vs. línea base: {data.profundidad.coverage.gapVsBaseline !== null ? pct(data.profundidad.coverage.gapVsBaseline) : '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
