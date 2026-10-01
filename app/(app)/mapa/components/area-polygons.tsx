'use client';

import { Polygon, Tooltip } from 'react-leaflet';
import { ringToLatLngs } from '@/lib/geo/geometry';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { AreaStats } from '@/lib/geo/area-match';
import type { Scale } from '@/lib/geo/color-scale';

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Non-interactive so pins and the "place location" click keep working
// above/through the polygons. Every area keeps a dark boundary and a
// permanent direct label, so fill colour is never the only signal.
export function AreaPolygons({
  areas, stats, scale, highlightId,
}: { areas: AreaDto[]; stats: Map<number, AreaStats>; scale: Scale | null; highlightId: number | null }) {
  return (
    <>
      {areas.map(a => {
        const s = stats.get(a.id);
        const highlighted = a.id === highlightId;
        return (
          <Polygon
            key={`${a.id}-${a.ring.length}`}
            positions={ringToLatLngs(a.ring)}
            interactive={false}
            pathOptions={{
              color: highlighted ? '#dc2626' : '#111827',
              weight: highlighted ? 4 : 2,
              dashArray: highlighted ? '6 4' : undefined,
              fillColor: scale ? scale.colorFor(s?.revenueUsd ?? 0) : a.color,
              fillOpacity: scale ? 0.65 : 0.2,
            }}
          >
            <Tooltip permanent direction="center" className="!bg-white !text-gray-900 !shadow">
              <strong>{a.name}</strong>
              {scale && <><br />{usd.format(s?.revenueUsd ?? 0)}</>}
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
