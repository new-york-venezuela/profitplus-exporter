'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { localIsoDate } from '@/lib/local-date';
import { addDuals, monthLabel, pct, units } from '../components/seguimiento/fmt';
import { moneyLabel, usdLabel } from '../lib/format';
import { EMPTY_TARGET_ROW, QuotaEditor, saveSellerTargetField, type SellerTargetRow } from '../components/quota-editor';
import { CustomerList, overdueLabel } from '../components/seguimiento/root-views';
import { UnbilledSection } from '../components/seguimiento/unbilled-section';
import { MixBar, MonthPaceStrip, WeekStrip } from '../components/seguimiento/visuals';
import {
  agingStatus, buildFindings, overdueStatus, ratioStatus, type Status,
} from '@/lib/seguimiento/seller-verdict';
import type { SeguimientoInvoiceLine, SeguimientoResponse, SeguimientoRoot } from '@/lib/seguimiento/types';
import type { Currency, DateRange, Seller360Response } from '../types';

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
      ? localIsoDate().slice(0, 7)
      : `${ytdMatch[1]}-12`;
  }

  // '12m' (and any other/legacy value) defaults to a trailing-365-day
  // window ending today, same as resolveDateBounds's own fallback.
  return localIsoDate().slice(0, 7);
}

const STATUS_CHIP: Record<Status, string> = {
  good: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-500',
};
const FINDING_DOT: Record<'good' | 'warn' | 'bad', string> = { good: 'bg-green-500', warn: 'bg-amber-500', bad: 'bg-red-500' };

function VerdictCard({ label, value, chip, status, subtitle }: {
  label: string; value: string; chip: string; status: Status; subtitle?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</h3>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${STATUS_CHIP[status]}`}>{chip}</span>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// Collapsible detail block; always expanded on paper.
function Section({ title, summary, defaultOpen = false, children }: {
  title: string; summary?: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label={title} className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left print:cursor-default"
      >
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {summary}
          <span aria-hidden className="print:hidden">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      <div className={`mt-3 ${open ? '' : 'hidden print:block'}`}>{children}</div>
    </section>
  );
}

interface LinesState { loading: boolean; error: string | null; lines: SeguimientoInvoiceLine[] }

const pastDueShareOf = (cob: Seller360Response['cobranza']): number | null => {
  const total = cob.buckets.reduce((s, b) => s + b.amount.bs, 0);
  if (cob.buckets.length === 0 || !(total > 0)) return null;
  const current = cob.buckets.filter(b => b.bucket.trim().toLowerCase() === 'current').reduce((s, b) => s + b.amount.bs, 0);
  return (total - current) / total;
};

export default function SellerProfile({ salesRepKey, dateRange, currency, onBack, backLabel = 'Volver a Seguimiento' }: {
  salesRepKey: string;
  dateRange: DateRange;
  currency: Currency;
  onBack: () => void;
  backLabel?: string;
}) {
  const [seg, setSeg] = useState<SeguimientoResponse | null>(null);
  const [segError, setSegError] = useState<string | null>(null);
  const [segLoading, setSegLoading] = useState(true);
  const [detail, setDetail] = useState<Seller360Response | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Bumped after a successful quota save to refetch Seguimiento (its 15-minute private cache would serve the pre-save response).
  const [reloadToken, setReloadToken] = useState(0);
  const [targetRow, setTargetRow] = useState<SellerTargetRow>(EMPTY_TARGET_ROW);
  const [editingMetas, setEditingMetas] = useState(false);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [linesByCustomer, setLinesByCustomer] = useState<Record<string, LinesState>>({});
  const generationRef = useRef(0);

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
            unitsQuota: typeof row?.unitsQuota === 'number' ? row.unitsQuota : null,
          });
        }
      } catch {
        // Non-fatal: the editors show "Definir meta" as if no row existed yet.
      }
    }
    loadTargetRow();
    return () => { cancelled = true; };
  }, [salesRepKey, periodMonth, reloadToken]);

  // saveSellerTargetField always POSTs the full three-field row (the route's upsert is delete-then-reinsert).
  async function saveQuotaField(field: keyof SellerTargetRow, newValue: number): Promise<boolean> {
    const ok = await saveSellerTargetField({ salesRepKey, periodMonth, current: targetRow, field, value: newValue });
    if (!ok) return false;
    setTargetRow(prev => ({ ...prev, [field]: newValue }));
    setReloadToken(t => t + 1);
    return true;
  }

  // Scorecard source: the same Seguimiento response (customer's CURRENT seller), so the numbers equal the Seguimiento tab's.
  useEffect(() => {
    let cancelled = false;
    generationRef.current += 1;
    async function load() {
      setSegError(null);
      setSegLoading(true);
      try {
        const params = new URLSearchParams({ kind: 'vendedor', dateRange });
        const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`, reloadToken > 0 ? { cache: 'no-store' } : undefined);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSegError(body.error ?? 'Error desconocido');
          return;
        }
        setSeg(await res.json());
        setOpenCustomer(null);
        setLinesByCustomer({});
      } catch {
        if (!cancelled) setSegError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setSegLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dateRange, reloadToken]);

  // Detail sections (devoluciones, recuperados, profundidad) cover the SAME month as the scorecard, never the raw range
  // (cobranza is always the latest balance snapshot).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDetailError(null);
      try {
        const params = new URLSearchParams({ salesRepKey, dateRange: `month:${periodMonth}` });
        const res = await fetch(`/api/dwh/vendedor-360?${params.toString()}`, { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setDetailError(body.error ?? 'Error desconocido');
          return;
        }
        setDetail(await res.json());
      } catch {
        if (!cancelled) setDetailError('No se pudo conectar con el servidor');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [salesRepKey, periodMonth]);

  async function openCustomerLines(code: string) {
    if (openCustomer === code) { setOpenCustomer(null); return; }
    setOpenCustomer(code);
    if (linesByCustomer[code]) return;
    const generation = generationRef.current;
    const write = (state: LinesState) => {
      if (generation !== generationRef.current) return;
      setLinesByCustomer(prev => ({ ...prev, [code]: state }));
    };
    write({ loading: true, error: null, lines: [] });
    try {
      const params = new URLSearchParams({ section: 'lines', customerCode: code, dateRange });
      const res = await fetch(`/api/dwh/seguimiento?${params.toString()}`);
      if (!res.ok) throw new Error('lines');
      const body: { lines: SeguimientoInvoiceLine[] } = await res.json();
      write({ loading: false, error: null, lines: body.lines });
    } catch {
      write({ loading: false, error: 'No se pudieron cargar las facturas', lines: [] });
    }
  }

  if (segLoading && !seg) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (segError && !seg) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4 print:hidden">{`← ${backLabel}`}</button>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{segError}</p>
      </div>
    );
  }
  if (!seg) return null;

  const root: SeguimientoRoot | undefined = seg.roots.find(r => r.value === salesRepKey);
  const name = root?.label ?? detail?.salesRepName ?? `Vendedor ${salesRepKey}`;
  const currentWeekIdx = seg.weeks.reduce((last, w, i) => (w.isFuture ? last : i), -1);
  const currentWeek = root && currentWeekIdx >= 0 ? root.weeks[currentWeekIdx] : null;
  const hasConsignment = !!root && root.excludedSales.bs > 0;
  const c = root?.compliance;
  const pastDueShare = detail ? pastDueShareOf(detail.cobranza) : null;

  const findings = root ? buildFindings({
    attainment: root.attainment,
    projectedAttainment: root.projectedAttainment,
    weekPcts: root.weeks.filter((_, i) => !seg.weeks[i]?.isFuture).map(w => w.pct),
    overdue: c?.overdue ?? 0,
    withInterval: (c?.ok ?? 0) + (c?.overdue ?? 0),
    newCount: root.newCustomers.count,
    newQuota: root.newCustomers.quota,
  }) : [];

  const weeklyQuota = root?.weeklyVisitQuota ?? null;
  const activeRatio = currentWeek && weeklyQuota ? currentWeek.active / weeklyQuota : null;
  const newRatio = root && root.newCustomers.quota ? root.newCustomers.count / root.newCustomers.quota : null;

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">{`← ${backLabel}`}</button>
        <button onClick={() => window.print()} className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700">
          Imprimir / PDF
        </button>
      </div>

      <div>
        <h1 className="text-lg font-bold text-gray-900">{name}</h1>
        <p className="text-xs text-gray-500">
          Resumen de {monthLabel(seg.month)} · al {seg.asOf}. Ventas brutas sin IVA por el vendedor actual del cliente (igual que Seguimiento).
          <span className="hidden print:inline"> Generado: {localIsoDate()}</span>
        </p>
        <div className="mt-1"><MonthPaceStrip pace={seg.pace} /></div>
      </div>

      {!root ? (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-4 py-3">
          Este vendedor no tiene clientes asignados ni ventas en {monthLabel(seg.month)}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <VerdictCard
              label="Ventas del mes"
              value={moneyLabel(root.sales, currency)}
              status={ratioStatus(root.attainment)}
              chip={root.attainment === null ? 'Sin meta' : `${pct(root.attainment)} de la meta`}
              subtitle={[
                root.salesQuotaUsd === null ? null : `Meta ${usdLabel(root.salesQuotaUsd)}`,
                hasConsignment ? `Con consignación: ${moneyLabel(addDuals(root.sales, root.excludedSales), currency)}` : null,
              ].filter(Boolean).join(' · ') || undefined}
            />
            <VerdictCard
              label="Proyección al cierre"
              value={root.projected ? moneyLabel(root.projected, currency) : '—'}
              status={ratioStatus(root.projectedAttainment)}
              chip={root.projectedAttainment === null ? 'Sin meta' : `${pct(root.projectedAttainment)} de la meta`}
              subtitle={hasConsignment && root.projectedWithConsignment ? `Con consignación: ${moneyLabel(root.projectedWithConsignment, currency)}` : undefined}
            />
            <VerdictCard
              label="Unidades vendidas"
              value={units(root.units)}
              status={ratioStatus(root.unitsAttainment ?? null)}
              chip={root.unitsQuota ? `${pct(root.unitsAttainment ?? null)} de la meta` : 'Sin meta'}
              subtitle={[
                root.unitsQuota ? `Meta ${units(root.unitsQuota)}` : null,
                hasConsignment && root.unitsWithConsignment != null ? `Con consignación: ${units(root.unitsWithConsignment)}` : null,
              ].filter(Boolean).join(' · ') || undefined}
            />
            <VerdictCard
              label="Proyección de unidades"
              value={units(root.projectedUnits)}
              status={ratioStatus(root.projectedUnitsAttainment ?? null)}
              chip={root.unitsQuota ? `${pct(root.projectedUnitsAttainment ?? null)} de la meta` : 'Sin meta'}
              subtitle={hasConsignment && root.projectedUnitsWithConsignment != null ? `Con consignación: ${units(root.projectedUnitsWithConsignment)}` : undefined}
            />
            <VerdictCard
              label="Clientes activos (semana actual)"
              value={currentWeek ? `${currentWeek.active} de ${currentWeek.assigned}` : '—'}
              status={ratioStatus(activeRatio)}
              chip={weeklyQuota === null ? 'Sin meta semanal' : `Meta ${weeklyQuota} por semana`}
              subtitle={currentWeek && currentWeek.pct !== null ? `${pct(currentWeek.pct)} de sus clientes` : undefined}
            />
            <VerdictCard
              label="Nuevos clientes"
              value={`${root.newCustomers.count}${root.newCustomers.quota === null ? '' : ` / ${root.newCustomers.quota}`}`}
              status={ratioStatus(newRatio)}
              chip={root.newCustomers.quota === null ? 'Sin meta' : `${pct(newRatio)} de la meta`}
            />
            <VerdictCard
              label="Visitas vencidas"
              value={overdueLabel(root)}
              status={overdueStatus(c?.overdue ?? 0, (c?.ok ?? 0) + (c?.overdue ?? 0))}
              chip={c && c.ok + c.overdue > 0 ? `${pct(c.overdue / (c.ok + c.overdue))} vencidas` : 'Sin frecuencia'}
            />
            <VerdictCard
              label="Cobranza vencida"
              value={pastDueShare === null ? '—' : pct(pastDueShare)}
              status={agingStatus(pastDueShare)}
              chip={detailError ? 'No disponible' : pastDueShare === null ? 'Sin saldos' : 'del saldo del vendedor'}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 print:break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-900 mb-2">Qué mirar</h2>
            {findings.length === 0 ? (
              <p className="text-sm text-gray-400">Sin alertas: no hay metas incumplidas ni tendencias a la baja.</p>
            ) : (
              <ul className="space-y-1">
                {findings.map(f => (
                  <li key={f.text} className="flex items-start gap-2 text-sm text-gray-800">
                    <span aria-hidden className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${FINDING_DOT[f.severity]}`} />
                    {f.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <UnbilledSection customers={root.customers} asOf={seg.asOf} />

          <div className="print:hidden">
            <button onClick={() => setEditingMetas(e => !e)} className="text-xs text-blue-600 hover:underline">
              {editingMetas ? 'Ocultar metas' : 'Editar metas'}
            </button>
            {editingMetas && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg p-3">
                <span>Ventas: <QuotaEditor currentValue={targetRow.salesQuotaUsd} field="salesQuotaUsd" suffix="USD" onSave={saveQuotaField} /></span>
                <span>Visitas por semana: <QuotaEditor currentValue={targetRow.weeklyVisitQuota} field="weeklyVisitQuota" onSave={saveQuotaField} /></span>
                <span>Clientes nuevos: <QuotaEditor currentValue={targetRow.newCustomerQuota} field="newCustomerQuota" onSave={saveQuotaField} /></span>
                <span>Unidades: <QuotaEditor currentValue={targetRow.unitsQuota} field="unitsQuota" onSave={saveQuotaField} /></span>
              </div>
            )}
          </div>

          <Section title="Activación semanal" summary={currentWeek && currentWeek.pct !== null ? `${pct(currentWeek.pct)} esta semana` : undefined} defaultOpen>
            <WeekStrip weeks={root.weeks} headers={seg.weeks} />
            <p className="text-xs text-gray-500 mt-2">
              {weeklyQuota === null ? 'Sin meta semanal definida.' : `Meta semanal: ${weeklyQuota} clientes.`} Cada barra es el % de sus clientes con factura esa semana.
            </p>
          </Section>

          <Section title="Mix por línea" summary={`${root.mix.length} líneas`}>
            <MixBar segments={root.mix} visibleLines={seg.visibleLines} />
          </Section>

          <Section title="Clientes" summary={`${root.customerCount} activos`} defaultOpen>
            <CustomerList
              customers={root.customers}
              headers={seg.weeks}
              visibleLines={seg.visibleLines}
              currency={currency}
              openCustomer={openCustomer}
              onOpenCustomer={openCustomerLines}
              linesFor={code => linesByCustomer[code] ?? { loading: true, error: null, lines: [] }}
            />
          </Section>
        </>
      )}

      {detailError && !detail && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          No se pudo cargar cobranza, devoluciones y cobertura: {detailError}
        </p>
      )}

      {detail && (
        <>
          <Section title="Cobranza (saldo actual por antigüedad)" summary={pastDueShare === null ? undefined : `${pct(pastDueShare)} vencido`}>
            {detail.cobranza.buckets.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Sin datos de antigüedad disponibles.</div>
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
                  {detail.cobranza.buckets.map(b => {
                    const baseline = detail.cobranza.baselineBuckets.find(x => x.bucket === b.bucket);
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
          </Section>

          <Section title="Devoluciones" summary={`${detail.devoluciones.byProduct.length} productos · ${detail.devoluciones.byTienda.length} tiendas`}>
            <p className="text-xs text-gray-500 mb-2">Por fecha de devolución, en {monthLabel(seg.month)}.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([['Por producto', detail.devoluciones.byProduct], ['Por tienda', detail.devoluciones.byTienda]] as const).map(([title, rows]) => (
                <div key={title}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">{title}</h3>
                  {rows.length === 0 ? (
                    <div className="text-sm text-gray-400 py-2">Sin devoluciones.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <tbody>
                        {rows.map(r => (
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
              ))}
            </div>
          </Section>

          <Section title="Clientes recuperados" summary={`${detail.clientesRecuperados.rows.length}`}>
            {detail.clientesRecuperados.rows.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Sin clientes recuperados en {monthLabel(seg.month)}.</div>
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
                  {detail.clientesRecuperados.rows.map(r => (
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
          </Section>

          <Section title="Profundidad de línea" summary={detail.profundidad.coverage ? pct(detail.profundidad.coverage.ownPenetration) : undefined}>
            {detail.profundidad.coverage === null ? (
              <div className="text-sm text-gray-400 py-2">Sin datos de cobertura para este vendedor en {monthLabel(seg.month)}.</div>
            ) : (
              <div className="text-sm">
                <div>Cobertura propia: <strong>{pct(detail.profundidad.coverage.ownPenetration)}</strong></div>
                <div className="text-gray-500">Línea base de la empresa: {pct(detail.profundidad.coverage.baselinePenetration)}</div>
                <div className={detail.profundidad.coverage.gapVsBaseline !== null && detail.profundidad.coverage.gapVsBaseline < 0 ? 'text-red-600' : 'text-green-600'}>
                  Diferencia vs. línea base: {detail.profundidad.coverage.gapVsBaseline !== null ? pct(detail.profundidad.coverage.gapVsBaseline) : '—'}
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
