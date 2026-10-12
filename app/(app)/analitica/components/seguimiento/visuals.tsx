'use client';

import type { MixSegment } from '@/lib/seguimiento/category-mix';
import type { MonthPace } from '@/lib/seguimiento/month-pace';
import { quotaBarGeometry } from '@/lib/seguimiento/quotas';
import type { Dual, NewCustomersInfo, WeekCell, WeekHeader } from '@/lib/seguimiento/types';
import type { VisitCompliance } from '@/lib/seguimiento/visit-compliance';
import { moneyLabel, usdLabel } from '../../lib/format';
import type { Currency } from '../../types';
import { lineColor } from './colors';
import { pct } from './fmt';

export function WeekStrip({ weeks, headers }: { weeks: WeekCell[]; headers: WeekHeader[] }) {
  const labelOf = (i: number) => headers[i]?.label ?? weeks[i].yearWeek;
  const summary = weeks.map((w, i) => `${labelOf(i)}: ${w.pct === null ? 'sin datos' : pct(w.pct)}`).join(', ');
  return (
    <div role="img" aria-label={`Activación semanal. ${summary}`} className="flex items-end gap-1 h-12">
      {weeks.map((w, i) => {
        const future = headers[i]?.isFuture ?? false;
        const height = future || w.pct === null ? 20 : Math.max(8, Math.round(w.pct * 100));
        return (
          <div key={w.yearWeek} className="flex flex-col items-center justify-end h-full w-6">
            <div
              data-testid={`week-bar-${w.yearWeek}`}
              data-pct={w.pct === null ? '' : String(w.pct)}
              title={w.pct === null ? `${labelOf(i)}: sin datos` : `${labelOf(i)}: ${w.active} de ${w.assigned} clientes (${pct(w.pct)})`}
              className={`w-full rounded-sm ${future ? 'border border-dashed border-gray-300 bg-gray-50' : 'bg-blue-500'}`}
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] text-gray-500 leading-none mt-0.5">{labelOf(i)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeekDots({ headers, activeWeeks }: { headers: WeekHeader[]; activeWeeks: string[] }) {
  const active = new Set(activeWeeks);
  const names = headers.filter(h => active.has(h.yearWeek)).map(h => h.label);
  return (
    <div role="img" aria-label={`Semanas con factura: ${names.length ? names.join(', ') : 'ninguna'}`} className="flex items-center gap-1">
      {headers.map(h => (
        <span
          key={h.yearWeek}
          title={h.label}
          className={`inline-block w-2.5 h-2.5 rounded-full ${active.has(h.yearWeek) ? 'bg-blue-500' : h.isFuture ? 'border border-dashed border-gray-300' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

function barTone(ratio: number | null, muted: boolean): string {
  if (muted || ratio === null) return 'bg-gray-400';
  if (ratio >= 1) return 'bg-green-500';
  if (ratio >= 0.8) return 'bg-amber-500';
  return 'bg-red-500';
}

export function QuotaBar({
  actual, quotaUsd, projected, currency, shared = false, partial = false,
}: {
  actual: Dual;
  quotaUsd: number | null;
  projected: Dual | null;
  currency: Currency;
  shared?: boolean;
  partial?: boolean;
}) {
  const geometry = quotaBarGeometry(actual.usd, quotaUsd, projected?.usd ?? null);
  if (!geometry || quotaUsd === null) {
    return (
      <div className="text-xs text-gray-500">
        <div className="font-medium text-gray-900">{moneyLabel(actual, currency)}</div>
        <div className="text-gray-400">Sin meta</div>
      </div>
    );
  }
  // The bar compares against a USD goal, so every figure on it is in USD whatever the
  // selected currency (a Bs. actual next to a $ goal read as a mismatch).
  const actualLabel = moneyLabel(actual, 'usd');
  const projectedLabel = projected ? moneyLabel(projected, 'usd') : '—';
  const quotaLabel = usdLabel(quotaUsd);
  const ratio = projected?.usd != null && quotaUsd ? projected.usd / quotaUsd : actual.usd != null && quotaUsd ? actual.usd / quotaUsd : null;
  return (
    <div className="text-xs text-gray-600">
      <div
        role="img"
        aria-label={`Ventas ${actualLabel}, meta ${quotaLabel}, proyección ${projectedLabel}`}
        className="relative h-3 rounded bg-gray-100 overflow-visible"
      >
        <div
          data-testid="quota-bar-fill"
          data-pct={geometry.fillPct}
          className={`absolute inset-y-0 left-0 rounded ${barTone(ratio, shared)}`}
          style={{ width: `${geometry.fillPct}%` }}
        />
        <div
          data-testid="quota-bar-target"
          data-pct={geometry.targetPct}
          title="Meta"
          className="absolute -top-1 -bottom-1 w-0.5 bg-gray-800"
          style={{ left: `${geometry.targetPct}%` }}
        />
        {geometry.projectionPct !== null && (
          <div
            data-testid="quota-bar-projection"
            data-pct={geometry.projectionPct}
            title="Proyección al cierre del mes"
            className="absolute -top-2 text-[10px] leading-none text-blue-700 -translate-x-1/2"
            style={{ left: `${geometry.projectionPct}%` }}
          >
            ▼
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-2">
        <span className="font-medium text-gray-900">{actualLabel}</span>
        <span>Meta {quotaLabel}</span>
        <span>Proy. {projectedLabel}</span>
      </div>
      {currency !== 'usd' && <div className="text-gray-400">Meta en USD</div>}
      {(shared || partial) && (
        <div className="text-amber-700">{shared ? 'Meta compartida' : 'Meta parcial'}</div>
      )}
    </div>
  );
}

export function MixBar({ segments, visibleLines }: { segments: MixSegment[]; visibleLines: readonly string[] }) {
  if (segments.length === 0) return <div className="text-xs text-gray-400">Sin ventas</div>;
  const label = segments.map(s => `${s.line} ${Math.round(s.share * 100)}%`).join(', ');
  return (
    <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded bg-gray-100">
      {segments.map(s => (
        <div
          key={s.line}
          data-testid={`mix-${s.line}`}
          title={`${s.line}: ${pct(s.share)}`}
          style={{ width: `${s.share * 100}%`, backgroundColor: lineColor(s.line, visibleLines) }}
        />
      ))}
    </div>
  );
}

export function NewCustomersChip({ info }: { info: NewCustomersInfo }) {
  const { count, quota, partial } = info;
  let text: string;
  let tone: string;
  if (quota === null) {
    text = `Nuevos ${count} (sin meta)`;
    tone = 'bg-gray-100 text-gray-600';
  } else {
    text = `Nuevos ${count} / ${quota}${partial ? '*' : ''}`;
    tone = count >= quota ? 'bg-green-100 text-green-800' : count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  }
  return (
    <span
      title={partial ? 'Meta parcial: falta la meta de algún vendedor' : 'Clientes registrados en el mes (sin el lote de migración) frente a la meta'}
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {text}
    </span>
  );
}

export function MonthPaceStrip({ pace }: { pace: MonthPace }) {
  const percent = Math.round(pace.fractionElapsed * 100);
  return (
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <span>
        Día laborable {pace.workingDaysElapsed} de {pace.workingDaysInMonth} · {(pace.fractionElapsed * 100).toFixed(1)}% del mes
      </span>
      <div
        role="progressbar"
        aria-label="Avance del mes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(pace.fractionElapsed * 100)}
        className="h-1.5 w-32 rounded bg-gray-200 overflow-hidden"
      >
        <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function VisitBadge({ visit }: { visit: VisitCompliance }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-medium';
  switch (visit.status) {
    case 'overdue':
      return <span className={`${base} bg-red-100 text-red-800`} title={`${visit.daysSinceLastInvoice} días desde la última factura; frecuencia ${visit.intervalDays} días`}>Vencida {visit.daysOverdue} d</span>;
    case 'ok':
      return <span className={`${base} bg-green-100 text-green-800`} title={`${visit.daysSinceLastInvoice} días desde la última factura`}>Al día</span>;
    case 'no_invoice':
      return <span className={`${base} bg-gray-100 text-gray-600`}>Sin compras</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-500`} title="El cliente no tiene frecuencia de visita asignada">Sin frecuencia</span>;
  }
}
