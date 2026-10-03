'use client';
import { monthDays, shiftMonth, timelineBars } from '@/lib/pricing/timeline';
import { todayIso } from '@/lib/pricing/dates';
import type { PromotionDto } from '@/lib/pricing/client-types';
import { fmtShort } from './promo-format';
import { FOCUS } from './dialog-parts';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const STATUS_TEXT: Record<PromotionDto['status'], string> = {
  scheduled: 'programada', active: 'activa', ended: 'terminada', cancelled: 'cancelada',
};
const BAR_CLASS: Record<PromotionDto['status'], string> = {
  scheduled: 'bg-blue-100 text-blue-900 border-blue-300',
  active: 'bg-green-100 text-green-900 border-green-300',
  ended: 'bg-gray-100 text-gray-700 border-gray-300',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-300 border-dashed line-through',
};

interface Props {
  promotions: PromotionDto[];
  month: string; // yyyy-mm-01
  onMonthChange: (monthStartIso: string) => void;
  onSelect: (id: number) => void;
}

const NAV = `min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 ${FOCUS}`;

export default function PromoTimeline({ promotions, month, onMonthChange, onSelect }: Props) {
  const days = monthDays(month);
  const bars = timelineBars(promotions, month);
  const lanes = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
  const today = todayIso();
  const todayDay = today.slice(0, 7) === month.slice(0, 7) ? Number(today.slice(8, 10)) : null;
  const byId = new Map(promotions.map(p => [p.id, p]));
  const label = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const describe = (p: PromotionDto) => `«${p.name}», del ${fmtShort(p.startsOn)} al ${fmtShort(p.endsOn)}, ${STATUS_TEXT[p.status]}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => onMonthChange(shiftMonth(month, -1))} className={NAV}>‹</button>
        <h3 aria-live="polite" className="min-w-[10rem] text-center text-sm font-semibold capitalize text-gray-900">{label}</h3>
        <button type="button" aria-label="Mes siguiente" onClick={() => onMonthChange(shiftMonth(month, 1))} className={NAV}>›</button>
        <button type="button" onClick={() => onMonthChange(`${today.slice(0, 7)}-01`)} className={NAV}>Hoy</button>
      </div>

      {bars.length === 0 ? (
        <p className="text-sm text-gray-500">No hay promociones en este mes</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
          <div className="relative grid min-w-[720px] gap-y-1"
            style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${lanes}, 44px)` }}>
            {Array.from({ length: days }, (_, i) => (
              <div key={i} aria-hidden="true"
                className={`border-l border-gray-100 text-center text-[10px] ${i + 1 === todayDay ? 'font-bold text-blue-700' : 'text-gray-400'}`}
                style={{ gridColumn: i + 1, gridRow: 1 }}>
                {i + 1}
              </div>
            ))}
            {todayDay !== null && (
              <div aria-hidden="true" title="Hoy" className="bg-blue-50"
                style={{ gridColumn: todayDay, gridRow: `2 / ${lanes + 2}`, zIndex: 0 }} />
            )}
            {bars.map(b => {
              const p = byId.get(b.id)!;
              return (
                <button key={b.id} type="button" aria-label={describe(p)} onClick={() => onSelect(b.id)}
                  style={{ gridColumn: `${b.startDay} / ${b.endDay + 1}`, gridRow: b.lane + 2, zIndex: 1 }}
                  className={`flex min-h-[44px] items-center gap-1 overflow-hidden border px-2 text-left text-xs font-medium ${FOCUS} ${BAR_CLASS[b.status]} ${
                    b.clippedStart ? 'rounded-l-none' : 'rounded-l-md'} ${b.clippedEnd ? 'rounded-r-none' : 'rounded-r-md'}`}>
                  {b.clippedStart && <span aria-hidden="true">‹</span>}
                  <span className="truncate">{b.name}</span>
                  <span className="shrink-0 opacity-80">· {STATUS_TEXT[b.status]}</span>
                  {b.clippedEnd && <span aria-hidden="true" className="ml-auto">›</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul aria-label="Promociones del mes" className="flex flex-col gap-1 text-sm text-gray-700">
        {bars.map(b => {
          const p = byId.get(b.id)!;
          return (
            <li key={b.id}>
              <button type="button" onClick={() => onSelect(b.id)}
                className={`min-h-[44px] rounded-md px-2 text-left hover:bg-gray-50 hover:underline ${FOCUS}`}>
                {describe(p)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
