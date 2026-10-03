'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import type { GridData, GridRow, PriceListDto } from '@/lib/pricing/client-types';
import type { PreviewCustomer, PreviewRow } from '@/lib/pricing/promotions-service';
import { addDaysIso, daysBetweenIso, isValidIsoDate, todayIso } from '@/lib/pricing/dates';
import { bulkNewPrices } from '@/lib/pricing/rates-math';
import { stageEdit, type BulkOp, type Staged } from '@/lib/pricing/rates-staging';
import {
  buildCreateBody, copyName, durationText, endsInText, NAME_MAX, REASON_MAX, validateStep, type StepErrors,
} from '@/lib/pricing/promo-wizard';
import { apiGet, apiSend, ApiError } from './api-client';
import { FOCUS, ErrorBox } from './dialog-parts';
import { fmtDate, fmtMoney, fmtShort } from './promo-format';
import PromoItemsGrid from './promo-items-grid';
import PromoCustomerPicker, { type PickedCustomer } from './promo-customer-picker';
import type { WizardPrefill } from './wizard-prefill';

const STEPS = ['Qué', 'Artículos y precio', 'Fechas', 'Revisión'] as const;
type Step = 1 | 2 | 3 | 4;

const FIELD = `min-h-[44px] w-full rounded-md border px-3 py-2 text-sm text-gray-900 ${FOCUS}`;
const BTN = `min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const PRIMARY = `min-h-[44px] rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');

export interface PromotionWizardProps {
  initial?: WizardPrefill;
  priceLists: PriceListDto[];
  onDone: (id: number) => void;
  onCancel: () => void;
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} role="alert" className="text-xs text-red-700">{children}</p> : null;
}

function Timeline({ startsOn, endsOn }: { startsOn: string; endsOn: string }) {
  const total = daysBetweenIso(startsOn, endsOn) + 1;
  const lead = Math.max(daysBetweenIso(todayIso(), startsOn), 0);
  const span = lead + total;
  return (
    <div>
      <div role="img" aria-label={`Del ${fmtShort(startsOn)} al ${fmtShort(endsOn)}, ${total} ${total === 1 ? 'día' : 'días'}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div style={{ width: `${(lead / span) * 100}%` }} />
        <div className="h-full bg-blue-500" style={{ width: `${(total / span) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500" aria-hidden="true">
        <span>{fmtDate(startsOn)}</span><span>{fmtDate(endsOn)}</span>
      </div>
    </div>
  );
}

export default function PromotionWizard({ initial, priceLists, onDone, onCancel }: PromotionWizardProps) {
  const today = todayIso();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;

  const [step, setStep] = useState<Step>(1);
  const [showErrors, setShowErrors] = useState(false);
  const [name, setName] = useState(() => (initial ? copyName(initial.name) : ''));
  const [reason, setReason] = useState(() => initial?.reason ?? '');
  const [kind, setKind] = useState<'overlay' | 'segment'>(() => initial?.kind ?? 'overlay');
  const [listCo, setListCo] = useState<string | null>(() => (initial ? (initial.kind === 'overlay' ? initial.coPrecio : initial.baseCoPrecio) : null));
  const [customers, setCustomers] = useState<PickedCustomer[]>(() => (initial?.customers ?? []).map(c => ({ coCli: c.coCli, cliDes: '' })));
  const [staged, setStaged] = useState<Staged>(() => Object.fromEntries((initial?.items ?? []).map(i => [i.coArt, i.monto])));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [discardNonce, setDiscardNonce] = useState(0);
  const [search, setSearch] = useState('');
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');

  // rates of the chosen list (request-id guarded; results are keyed by list so a late one never shows for another)
  const [grid, setGrid] = useState<{ co: string; data: GridData } | null>(null);
  const [gridFail, setGridFail] = useState<{ co: string; message: string } | null>(null);
  const [gridTick, setGridTick] = useState(0);
  const gridReq = useRef(0);
  useEffect(() => {
    if (!listCo) return;
    const reqId = ++gridReq.current;
    apiGet<GridData>(`/api/pricing/lists/${encodeURIComponent(listCo)}/rates`)
      .then(data => { if (reqId === gridReq.current) { setGrid({ co: listCo, data }); setGridFail(null); } })
      .catch(e => { if (reqId === gridReq.current) setGridFail({ co: listCo, message: errMsg(e) }); });
  }, [listCo, gridTick]);

  const gridData = grid && grid.co === listCo ? grid.data : null;
  const gridError = gridFail && gridFail.co === listCo ? gridFail.message : null;
  const gridLoading = listCo !== null && !gridData && !gridError;

  // The promotion's reference is the CURRENT price, not the grid's previous-tariff reference.
  const rows = useMemo<GridRow[]>(
    () => (gridData?.rows ?? []).map(r => ({ ...r, referenceMonto: r.current?.monto ?? null })),
    [gridData],
  );
  const items = useMemo(
    () => rows.filter(r => r.current !== null && !r.ambiguous && staged[r.coArt] !== undefined).map(r => ({ coArt: r.coArt, monto: staged[r.coArt] })),
    [rows, staged],
  );

  const fields = { name, reason, kind, listCo, customerCodes: customers.map(c => c.coCli), itemCount: items.length, startsOn, endsOn };
  const errors: StepErrors = step === 4 ? {} : validateStep(step, fields, today);

  const body = useMemo(
    () => (listCo ? buildCreateBody({ name, reason, kind, listCo, customerCodes: customers.map(c => c.coCli), startsOn, endsOn, items }) : null),
    [name, reason, kind, listCo, customers, startsOn, endsOn, items],
  );
  const bodyKey = useMemo(() => JSON.stringify(body), [body]);

  // preview (step 4)
  const [preview, setPreview] = useState<{ key: string; rows: PreviewRow[]; customers: PreviewCustomer[] } | null>(null);
  const [previewFail, setPreviewFail] = useState<{ key: string; message: string } | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [skip, setSkip] = useState<{ key: string; value: boolean } | null>(null);
  const previewReq = useRef(0);
  useEffect(() => {
    if (step !== 4 || !body) return;
    const reqId = ++previewReq.current;
    const key = JSON.stringify(body);
    apiSend<{ rows: PreviewRow[]; customers: PreviewCustomer[] }>('/api/pricing/promotions/preview', 'POST', body)
      .then(d => { if (reqId === previewReq.current) { setPreview({ key, rows: d.rows, customers: d.customers }); setPreviewFail(null); } })
      .catch(e => { if (reqId === previewReq.current) setPreviewFail({ key, message: errMsg(e) }); });
  }, [step, body, previewTick]);

  const livePreview = preview && preview.key === bodyKey ? preview : null;
  const previewError = previewFail && previewFail.key === bodyKey ? previewFail.message : null;
  const previewLoading = step === 4 && !livePreview && !previewError;
  const rejected = livePreview ? livePreview.rows.filter(r => r.status === 'rejected') : [];
  const skipRejected = skip?.key === bodyKey && skip.value;
  const sendItems = livePreview
    ? items.filter(i => !(skipRejected && rejected.some(r => r.coArt === i.coArt)))
    : [];
  const canApply = !!livePreview && !!body && sendItems.length > 0 && (rejected.length === 0 || skipRejected);

  // focus + announcement on step change
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  // apply
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; warning: string } | null>(null);

  function changeList(co: string | null) {
    if (co === listCo) return;
    setListCo(co);
    setStaged({});
    setSelected(new Set());
    setBulkNote(null);
    setSearch('');
    setShowUnpriced(false);
    setDiscardNonce(n => n + 1);
  }

  function onStage(coArt: string, monto: number | null) {
    setStaged(s => stageEdit(s, coArt, monto));
  }

  function onToggle(coArt: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(coArt)) n.delete(coArt); else n.add(coArt); return n; });
  }

  function onToggleAll(visible: string[], all: boolean) {
    setSelected(prev => { const n = new Set(prev); for (const c of visible) { if (all) n.add(c); else n.delete(c); } return n; });
  }

  function onBulk(op: BulkOp) {
    const chosen = rows.filter(r => selected.has(r.coArt) && r.current !== null && !r.ambiguous);
    const prices = bulkNewPrices(chosen.map(r => ({ coArt: r.coArt, reference: r.referenceMonto })), op);
    setStaged(s => Object.entries(prices).reduce((acc, [coArt, monto]) => stageEdit(acc, coArt, monto), s));
    const skipped = chosen.length - Object.keys(prices).length;
    setBulkNote(skipped > 0 ? `${skipped} ${skipped === 1 ? 'fila sin precio de referencia omitida' : 'filas sin precio de referencia omitidas'}` : null);
  }

  function next() {
    if (step === 4) return;
    if (Object.keys(errors).length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setStep((step + 1) as Step);
  }

  function back() {
    if (step === 1) return;
    setShowErrors(false);
    setStep((step - 1) as Step);
  }

  async function apply() {
    if (!canApply || !body || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      const { promotion } = await apiSend<{ promotion: { id: number; warning?: string } }>(
        '/api/pricing/promotions', 'POST', { ...body, items: sendItems });
      if (promotion.warning) setCreated({ id: promotion.id, warning: promotion.warning });
      else onDone(promotion.id);
    } catch (e) {
      setApplyError(errMsg(e));
    } finally {
      setApplying(false);
    }
  }

  const listOptions = useMemo(() => priceLists.map(l => ({ value: l.coPrecio, label: `${l.coPrecio} · ${l.desPrecio}` })), [priceLists]);
  const shown = (key: keyof StepErrors) => (showErrors ? errors[key] : undefined);

  if (created) {
    return (
      <section aria-label="Promoción creada" className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Promoción creada</h2>
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{created.warning}</div>
        <button type="button" onClick={() => onDone(created.id)} className={PRIMARY}>Ver promoción</button>
      </section>
    );
  }

  return (
    <section aria-label="Nueva promoción" className="flex min-w-0 flex-col gap-5">
      <ol aria-label="Pasos del asistente" className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const current = n === step;
          return (
            <li key={label} aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${current ? 'bg-blue-600 font-medium text-white' : n < step ? 'bg-blue-50 text-blue-900' : 'bg-gray-100 text-gray-600'}`}>
              <span aria-hidden="true">{n}</span><span>{label}</span>
            </li>
          );
        })}
      </ol>
      <div aria-live="polite" className="sr-only">Paso {step} de 4: {STEPS[step - 1]}</div>

      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 outline-none">
        Paso {step}: {STEPS[step - 1]}
      </h2>

      {step === 1 && (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={id('name')} className="text-sm font-medium text-gray-700">Nombre de la promoción</label>
            <input id={id('name')} type="text" value={name} maxLength={NAME_MAX + 20} onChange={e => setName(e.target.value)}
              aria-invalid={shown('name') ? true : undefined} aria-describedby={shown('name') ? id('name-err') : undefined}
              className={`${FIELD} ${shown('name') ? 'border-red-500' : 'border-gray-300'}`} />
            <span className="text-xs text-gray-500">{name.trim().length}/{NAME_MAX}</span>
            <FieldError id={id('name-err')}>{shown('name')}</FieldError>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={id('reason')} className="text-sm font-medium text-gray-700">Motivo (opcional)</label>
            <input id={id('reason')} type="text" value={reason} onChange={e => setReason(e.target.value)}
              aria-invalid={shown('reason') ? true : undefined} aria-describedby={shown('reason') ? id('reason-err') : undefined}
              className={`${FIELD} ${shown('reason') ? 'border-red-500' : 'border-gray-300'}`} />
            <span className="text-xs text-gray-500">{reason.trim().length}/{REASON_MAX}</span>
            <FieldError id={id('reason-err')}>{shown('reason')}</FieldError>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-700">Tipo de promoción</legend>
            {([
              ['overlay', 'Sobre una lista', 'El precio promocional rige en la lista elegida durante las fechas; al terminar vuelve el precio regular.'],
              ['segment', 'Para un segmento o clientes', 'Los clientes elegidos pasan a un segmento temporal con precios promocionales y regresan al terminar.'],
            ] as const).map(([value, label, help]) => (
              <label key={value} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                <input type="radio" name={id('kind')} value={value} checked={kind === value} onChange={() => setKind(value)}
                  className={`mt-1 h-4 w-4 ${FOCUS}`} />
                <span className="flex flex-col"><span className="text-sm font-medium text-gray-900">{label}</span><span className="text-xs text-gray-600">{help}</span></span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1">
            <span id={id('list-label')} className="text-sm font-medium text-gray-700">{kind === 'overlay' ? 'Lista de precios' : 'Lista base'}</span>
            <SearchableSelect value={listCo} onChange={changeList} options={listOptions} placeholder="Buscar lista"
              ariaLabel={kind === 'overlay' ? 'Lista de precios' : 'Lista base'} />
            <FieldError id={id('list-err')}>{shown('list')}</FieldError>
          </div>

          {kind === 'segment' && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Clientes</span>
              <PromoCustomerPicker picked={customers} onChange={setCustomers} errorId={id('cust-err')} invalid={!!shown('customers')} />
              <FieldError id={id('cust-err')}>{shown('customers')}</FieldError>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Fija el precio promocional de cada artículo. El precio regular es el vigente hoy en la lista
            {gridData?.list ? ` ${gridData.list.coPrecio}` : ''}; escribe el precio o el Δ%, o marca varios artículos para usar las acciones masivas.
          </p>
          {bulkNote && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{bulkNote}</div>}
          <PromoItemsGrid
            rows={rows} staged={staged} onStage={onStage} selected={selected} onToggle={onToggle} onToggleAll={onToggleAll} onBulk={onBulk}
            search={search} onSearchChange={setSearch} showUnpriced={showUnpriced} onShowUnpricedChange={setShowUnpriced}
            discardNonce={discardNonce} currency={gridData?.list.coMone ?? null} loading={gridLoading} error={gridError}
            onRetry={() => setGridTick(t => t + 1)}
          />
          <p id={id('items-err')} role={shown('items') ? 'alert' : undefined} className="text-sm text-red-700">{shown('items')}</p>
        </div>
      )}

      {step === 3 && (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor={id('start')} className="text-sm font-medium text-gray-700">Inicio</label>
              <input id={id('start')} type="date" value={startsOn} min={today}
                onChange={e => { const v = e.target.value; setStartsOn(v); if (endsOn && isValidIsoDate(v) && endsOn < v) setEndsOn(''); }}
                aria-invalid={shown('startsOn') ? true : undefined} aria-describedby={shown('startsOn') ? id('start-err') : undefined}
                className={`${FIELD} w-48 ${shown('startsOn') ? 'border-red-500' : 'border-gray-300'}`} />
              <FieldError id={id('start-err')}>{shown('startsOn')}</FieldError>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={id('end')} className="text-sm font-medium text-gray-700">Fin (inclusive)</label>
              <input id={id('end')} type="date" value={endsOn} min={isValidIsoDate(startsOn) && startsOn > today ? startsOn : today}
                onChange={e => setEndsOn(e.target.value)}
                aria-invalid={shown('endsOn') ? true : undefined} aria-describedby={shown('endsOn') ? id('end-err') : undefined}
                className={`${FIELD} w-48 ${shown('endsOn') ? 'border-red-500' : 'border-gray-300'}`} />
              <FieldError id={id('end-err')}>{shown('endsOn')}</FieldError>
            </div>
          </div>
          <p aria-live="polite" className="text-sm font-medium text-gray-900">
            {Object.keys(validateStep(3, fields, today)).length === 0 ? [endsInText(today, endsOn), durationText(startsOn, endsOn)].filter(Boolean).join(' · ') : ''}
          </p>
          <p className="text-xs text-gray-500">El último día rige hasta las 23:59. Inicio y fin pueden ser el mismo día.</p>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-gray-500">Nombre</dt><dd className="font-medium text-gray-900">{name.trim()}</dd>
            <dt className="text-gray-500">Tipo</dt><dd>{kind === 'overlay' ? 'Sobre una lista' : 'Para un segmento o clientes'}</dd>
            <dt className="text-gray-500">{kind === 'overlay' ? 'Lista' : 'Lista base'}</dt>
            <dd>{listOptions.find(o => o.value === listCo)?.label ?? listCo}</dd>
            <dt className="text-gray-500">Fechas</dt><dd>{fmtDate(startsOn)} al {fmtDate(endsOn)}</dd>
          </dl>
          <Timeline startsOn={startsOn} endsOn={endsOn} />

          {previewLoading && <div aria-busy="true" role="status" className="text-sm text-gray-600">Revisando los precios…</div>}
          {previewError && (
            <ErrorBox>
              <span>{previewError}</span>
              <button type="button" onClick={() => setPreviewTick(t => t + 1)} className={BTN}>Reintentar</button>
            </ErrorBox>
          )}

          {livePreview && (
            <>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Resultado de la revisión por artículo</caption>
                  <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">Artículo</th>
                      <th scope="col" className="px-3 py-2 text-right">Regular → Promo</th>
                      <th scope="col" className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {livePreview.rows.map(r => (
                      <tr key={r.coArt} className={r.status === 'rejected' ? 'bg-red-50' : undefined}>
                        <td className="px-3 py-2"><span className="text-xs text-gray-500">{r.coArt}</span> <span className="font-medium text-gray-900">{r.artDes}</span></td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.regular)} → {fmtMoney(r.promo)}</td>
                        <td className="px-3 py-2">
                          {r.status === 'ok'
                            ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">OK</span>
                            : <span><span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Rechazado</span> <span className="text-xs text-red-700">{r.message}</span></span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {kind === 'segment' && livePreview.customers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {livePreview.customers.length} {livePreview.customers.length === 1 ? 'cliente pasará' : 'clientes pasarán'} al segmento de la promoción
                  </h3>
                  <p className="text-xs text-gray-600">Volverán a su segmento anterior el {fmtShort(addDaysIso(endsOn, 1))} (tarea nocturna de barrido).</p>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-gray-800">
                    {livePreview.customers.map(c => <li key={c.coCli}>{c.cliDes} <span className="text-xs text-gray-500">({c.coCli})</span></li>)}
                  </ul>
                </div>
              )}

              {rejected.length > 0 && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={skipRejected} onChange={e => setSkip({ key: bodyKey, value: e.target.checked })}
                    className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
                  Continuar sin los artículos rechazados ({rejected.length})
                </label>
              )}
              {rejected.length > 0 && skipRejected && sendItems.length === 0 && (
                <p role="alert" className="text-sm text-red-700">Todos los artículos fueron rechazados; vuelve atrás y elige otros.</p>
              )}
            </>
          )}
          {applyError && <ErrorBox><span>{applyError}</span></ErrorBox>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
        <button type="button" onClick={onCancel} disabled={applying} className={BTN}>Cancelar</button>
        <div className="flex gap-2">
          <button type="button" onClick={back} disabled={step === 1 || applying} className={BTN}>Atrás</button>
          {step < 4 ? (
            <button type="button" onClick={next} className={PRIMARY}>Siguiente</button>
          ) : (
            <button type="button" onClick={() => void apply()} disabled={!canApply || applying} className={PRIMARY}>
              {applying ? 'Aplicando…' : 'Aplicar'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
