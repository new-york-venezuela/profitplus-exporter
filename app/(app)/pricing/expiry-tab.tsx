'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { HealthReport } from '@/lib/pricing/health-loader';
import type { PromotionDto } from '@/lib/pricing/client-types';
import { todayIso } from '@/lib/pricing/dates';
import { apiGet, ApiError } from './api-client';
import { FOCUS } from './dialog-parts';
import { fmtDate, fmtShort } from './promo-format';
import HealthSection from './health-section';
import PromoTimeline from './promo-timeline';
import AlertSettingsDialog from './alert-settings-dialog';

type View = 'listas' | 'timeline';
const WINDOWS = [7, 14, 30];
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');
const LINK = `inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-medium text-blue-700 hover:underline ${FOCUS}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function Badge({ tone, children }: { tone: 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  const cls = tone === 'bad' ? 'bg-red-100 text-red-700' : tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Row({ children, link }: { children: ReactNode; link: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-1 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800">{children}</div>
      {link}
    </li>
  );
}

function sweepView(s: HealthReport['sweep']): { text: string; badge: string; tone: 'ok' | 'warn' | 'bad' } {
  switch (s.state) {
    case 'never': return { text: 'El barrido no se ha ejecutado nunca — revisa el programador de tareas', badge: 'Sin ejecutar', tone: 'bad' };
    case 'stale': return { text: `Barrido atrasado: último hace ${s.hoursSince} h`, badge: 'Atrasado', tone: 'warn' };
    case 'failed': return {
      text: `El último barrido falló: ${s.error ?? (s.failed > 0 ? `${s.failed} ${plural(s.failed, 'cliente', 'clientes')} con error` : 'error desconocido')}`,
      badge: 'Falló', tone: 'bad',
    };
    default: return { text: `Último barrido hace ${s.hoursSince} h`, badge: 'Al día', tone: 'ok' };
  }
}

export default function ExpiryTab({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View>('listas');
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionDto[] | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [month, setMonth] = useState(`${todayIso().slice(0, 7)}-01`);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const viewRefs = useRef<Record<View, HTMLButtonElement | null>>({ listas: null, timeline: null });

  useEffect(() => {
    let cancelled = false;
    apiGet<{ report: HealthReport }>(`/api/pricing/health?days=${days}`)
      .then(d => { if (!cancelled) { setReport(d.report); setError(null); } })
      .catch(e => { if (!cancelled) setError(errMsg(e)); });
    return () => { cancelled = true; };
  }, [days, reloadTick]);

  useEffect(() => {
    if (view !== 'timeline' || promotions !== null) return;
    let cancelled = false;
    apiGet<{ promotions: PromotionDto[] }>('/api/pricing/promotions')
      .then(d => { if (!cancelled) setPromotions(d.promotions); })
      .catch(e => { if (!cancelled) setPromoError(errMsg(e)); });
    return () => { cancelled = true; };
  }, [view, promotions]);

  function onViewKey(e: React.KeyboardEvent, current: View) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: View = current === 'listas' ? 'timeline' : 'listas';
    setView(next);
    viewRefs.current[next]?.focus();
  }

  const loading = (report === null || report.withinDays !== days) && error === null;
  const segBtn = (v: View, label: string) => (
    <button key={v} type="button" role="tab" ref={el => { viewRefs.current[v] = el; }}
      aria-selected={view === v} tabIndex={view === v ? 0 : -1} onClick={() => setView(v)} onKeyDown={e => onViewKey(e, v)}
      className={`min-h-[44px] px-4 text-sm font-medium ${FOCUS} ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
      {label}
    </button>
  );

  const sweep = report ? sweepView(report.sweep) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Vista de vencimientos" className="inline-flex overflow-hidden rounded-md border border-gray-300">
          {segBtn('listas', 'Listas')}
          {segBtn('timeline', 'Línea de tiempo')}
        </div>
        {view === 'listas' && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Terminan en los próximos
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              className={`min-h-[44px] rounded-md border border-gray-300 bg-white px-2 text-sm ${FOCUS}`}>
              {WINDOWS.map(w => <option key={w} value={w}>{w} días</option>)}
            </select>
          </label>
        )}
        {isAdmin && (
          <button type="button" onClick={() => setSettingsOpen(true)}
            className={`ml-auto min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`}>
            Alertas por correo
          </button>
        )}
      </div>

      {view === 'listas' && error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => { setError(null); setReloadTick(t => t + 1); }}
            className={`min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 ${FOCUS}`}>
            Reintentar
          </button>
        </div>
      )}

      {view === 'listas' && !error && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HealthSection id="ending" title="Terminan pronto" count={report?.endingSoon.length ?? null} loading={loading}
            emptyText={`Ninguna promoción termina en los próximos ${days} días`}>
            <ul>
              {report?.endingSoon.map(i => (
                <Row key={i.promotionId} link={<Link className={LINK} href={`/pricing?tab=promociones&promo=${i.promotionId}`}>Ver promoción</Link>}>
                  <strong>{i.name}</strong>
                  <Badge tone={i.daysLeft <= 1 ? 'bad' : 'warn'}>
                    {i.daysLeft <= 0 ? 'Termina hoy' : i.daysLeft === 1 ? 'Termina mañana' : `Termina en ${i.daysLeft} días`}
                  </Badge>
                  <span className="text-gray-500">{fmtDate(i.endsOn)} · {i.kind === 'segment' ? 'segmento' : 'lista'}</span>
                </Row>
              ))}
            </ul>
          </HealthSection>

          <HealthSection id="unreverted" title="Vencidas sin revertir" count={report ? report.unreverted.length + report.stranded.length : null}
            loading={loading} emptyText="Ningún segmento vencido ni promoción terminada con precios vigentes">
            <ul>
              {report?.unreverted.map(u => (
                <Row key={u.tipCli} link={<Link className={LINK} href={`/pricing?tab=segmentos&segment=${encodeURIComponent(u.tipCli)}`}>Ver segmento</Link>}>
                  <strong>{u.label}</strong>
                  <Badge tone="bad">Venció hace {u.daysOverdue} {plural(u.daysOverdue, 'día', 'días')}</Badge>
                  <span className="text-gray-500">{u.customerCount} {plural(u.customerCount, 'cliente', 'clientes')} aún dentro</span>
                </Row>
              ))}
              {report?.stranded.map(s => (
                <Row key={`s${s.promotionId}`} link={<Link className={LINK} href={`/pricing?tab=promociones&promo=${s.promotionId}`}>Ver promoción</Link>}>
                  <strong>{s.name}</strong>
                  <Badge tone="bad">Terminó con precios vigentes</Badge>
                  <span className="text-gray-500">
                    {fmtDate(s.endsOn)} · {s.itemCount} {plural(s.itemCount, 'precio sigue', 'precios siguen')} vigente{s.itemCount === 1 ? '' : 's'}
                  </span>
                </Row>
              ))}
            </ul>
          </HealthSection>

          <HealthSection id="lapsed" title="Sin precio vigente" count={report?.lapsed.length ?? null} loading={loading}
            emptyText="Todos los artículos de las listas en uso tienen precio vigente">
            <ul>
              {report?.lapsed.slice(0, 50).map(l => (
                <Row key={`${l.coPrecio}|${l.coArt}|${l.coAlma}`}
                  link={<Link className={LINK} href={`/pricing?tab=listas&list=${encodeURIComponent(l.coPrecio)}`}>Ver lista</Link>}>
                  <strong>{l.coArt}</strong>
                  <Badge tone="bad">Sin precio</Badge>
                  <span className="text-gray-500">
                    Lista {l.coPrecio} · almacén {l.coAlma}
                    {l.lastHasta ? ` · desde ${fmtShort(l.lastHasta)}` : ''}{l.nextDesde ? ` · vuelve el ${fmtShort(l.nextDesde)}` : ''}
                  </span>
                </Row>
              ))}
            </ul>
            {report && report.lapsed.length > 50 && <p className="pt-2 text-xs text-gray-500">y {report.lapsed.length - 50} más…</p>}
          </HealthSection>

          <HealthSection id="sweep" title="Estado del barrido" count={null} loading={loading}>
            {sweep && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
                <Badge tone={sweep.tone}>{sweep.badge}</Badge>
                <span>{sweep.text}</span>
              </div>
            )}
          </HealthSection>
        </div>
      )}

      {view === 'timeline' && (
        promoError ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{promoError}</div>
        ) : promotions === null ? (
          <div aria-busy="true" aria-label="Cargando promociones" className="h-40 animate-pulse rounded-md bg-gray-100" />
        ) : (
          <PromoTimeline promotions={promotions} month={month} onMonthChange={setMonth}
            onSelect={id => router.push(`/pricing?tab=promociones&promo=${id}`)} />
        )
      )}

      {settingsOpen && <AlertSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
