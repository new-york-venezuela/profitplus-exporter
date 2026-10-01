import L from 'leaflet';
import type { Pareto } from '@/lib/geo/types';

// White text on each fill is ≥ 4.5:1. The letter (A/B/C/–) means colour is
// never the only signal. The outer 44×44 box is the touch target.
export const PARETO_COLORS: Record<Pareto | 'none', string> = {
  A: '#15803d', B: '#b45309', C: '#475569', none: '#6b7280',
};

const cache = new Map<string, L.DivIcon>();

function build(label: string, color: string, selected: boolean): L.DivIcon {
  const outline = selected ? ';outline:3px solid #2563eb;outline-offset:1px' : '';
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -16],
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">`
      + `<span style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;`
      + `font:600 13px/28px system-ui,sans-serif;text-align:center;border:2px solid #fff;`
      + `box-shadow:0 1px 3px rgba(0,0,0,.5)${outline}">${label}</span></div>`,
  });
}

export function pinIcon(pareto: Pareto | null, selected: boolean): L.DivIcon {
  const key = `${pareto ?? 'none'}:${selected}`;
  let icon = cache.get(key);
  if (!icon) { icon = build(pareto ?? '–', PARETO_COLORS[pareto ?? 'none'], selected); cache.set(key, icon); }
  return icon;
}

export function editIcon(): L.DivIcon {
  const key = 'edit';
  let icon = cache.get(key);
  if (!icon) { icon = build('✎', '#2563eb', true); cache.set(key, icon); }
  return icon;
}
