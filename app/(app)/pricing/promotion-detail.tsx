'use client';

import type { PromotionDetailDto, PromotionDto } from '@/lib/pricing/client-types';
import { daysBetweenIso, todayIso } from '@/lib/pricing/dates';
import { promoStatusBadge } from './promo-status-badge';
import { fmtDate, fmtMoney, fmtShort, TONE_CLASS } from './promo-format';

interface Props {
  detail: PromotionDetailDto | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  onCancel: () => void;
  onChangeEnd: () => void;
  onRetry: () => void;
  onDuplicate: () => void;
  onReload?: () => void;
  retrying?: boolean;
}

const BTN = 'min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const TH = 'px-3 py-2 text-left text-xs font-semibold text-gray-600';
const TD = 'px-3 py-2 text-sm text-gray-800';

function Timeline({ p }: { p: Pick<PromotionDto, 'startsOn' | 'endsOn' | 'status'> }) {
  const today = todayIso();
  const total = daysBetweenIso(p.startsOn, p.endsOn) + 1;
  const day = Math.min(Math.max(daysBetweenIso(p.startsOn, today) + 1, 0), total);
  const range = `Del ${fmtShort(p.startsOn)} al ${fmtShort(p.endsOn)}`;
  const label = p.status === 'cancelled' ? `${range}, cancelada`
    : day === 0 ? `${range}, empieza el ${fmtShort(p.startsOn)}`
    : today > p.endsOn ? `${range}, terminada`
    : `${range}, hoy día ${day} de ${total}`;
  const pct = p.status === 'cancelled' ? 0 : Math.round((day / total) * 100);
  return (
    <div>
      <div role="img" aria-label={label} className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500" aria-hidden="true">
        <span>{fmtDate(p.startsOn)}</span><span>{fmtDate(p.endsOn)}</span>
      </div>
    </div>
  );
}

export default function PromotionDetail({ detail, loading, error, canEdit, onCancel, onChangeEnd, onRetry, onDuplicate, onReload, retrying = false }: Props) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Cargando promoción" className="flex flex-col gap-3">
        <div className="h-8 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-3 animate-pulse rounded-full bg-gray-100" />
        {[0, 1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <span>{error}</span>
        {onReload && (
          <button type="button" onClick={onReload}
            className="min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Reintentar
          </button>
        )}
      </div>
    );
  }
  if (!detail) return <p className="text-sm text-gray-500">Selecciona una promoción para ver su detalle</p>;

  const badge = promoStatusBadge(detail);
  const open = detail.status === 'scheduled' || detail.status === 'active';
  const showRetry = detail.partial && detail.status !== 'ended' && detail.status !== 'cancelled';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="break-words">{detail.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>
          </h2>
          <p className="text-sm text-gray-600">
            {detail.kind === 'segment' ? 'Segmento' : 'Lista'} · {detail.coPrecio}{detail.desPrecio ? ` · ${detail.desPrecio}` : ''}
            {' · '}{fmtDate(detail.startsOn)} – {fmtDate(detail.endsOn)}
          </p>
          {detail.reason && <p className="text-sm text-gray-500">Motivo: {detail.reason}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {open && <button type="button" onClick={onChangeEnd} className={BTN}>Cambiar fecha de fin</button>}
            {showRetry && <button type="button" onClick={onRetry} disabled={retrying} className={BTN}>{retrying ? 'Reintentando…' : 'Reintentar'}</button>}
            <button type="button" onClick={onDuplicate} className={BTN}>Duplicar</button>
            {open && (
              <button type="button" onClick={onCancel}
                className="min-h-[44px] rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                Cancelar
              </button>
            )}
          </div>
        )}
      </header>

      {detail.warning && (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{detail.warning}</div>
      )}

      <Timeline p={detail} />

      <section aria-label="Artículos" className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className={TH}>Artículo</th>
              <th scope="col" className={`${TH} text-right`}>Regular</th>
              <th scope="col" className={`${TH} text-right`}>Promo</th>
              <th scope="col" className={`${TH} text-right`}>%</th>
              <th scope="col" className={TH}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detail.items.map(i => {
              const pct = i.regularMonto ? Math.round((1 - i.promoMonto / i.regularMonto) * 1000) / 10 : null;
              return (
                <tr key={i.coArt}>
                  <td className={TD}><span className="font-medium">{i.artDes}</span> <span className="text-xs text-gray-500">{i.coArt}</span></td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtMoney(i.regularMonto)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtMoney(i.promoMonto)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{pct === null ? '—' : `${pct.toLocaleString('es-VE')} %`}</td>
                  <td className={TD}>
                    {i.cancelledOn ? <span className="text-gray-600">Cancelado</span>
                      : i.applied ? <span className="text-green-700">Aplicado</span>
                      : i.message ? <span className="text-red-700">{i.message}</span>
                      : <span className="text-gray-600">Pendiente</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {detail.kind === 'segment' && (
        <section aria-label="Clientes" className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className={TH}>Cliente</th>
                <th scope="col" className={TH}>Segmento previo</th>
                <th scope="col" className={TH}>Movido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.customers.length === 0 ? (
                <tr><td colSpan={3} className={`${TD} text-gray-500`}>Sin clientes</td></tr>
              ) : detail.customers.map(c => (
                <tr key={c.coCli}>
                  <td className={TD}><span className="font-medium">{c.cliDes}</span> <span className="text-xs text-gray-500">{c.coCli}</span></td>
                  <td className={TD}>{c.previousTipCli}</td>
                  <td className={TD}>{c.moved ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
