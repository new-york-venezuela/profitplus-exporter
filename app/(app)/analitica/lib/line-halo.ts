// Shared styling for the dashed trend line drawn over stacked bars. A wider white
// "halo" line underneath keeps the dark dashed stroke legible over blue/hatched fills.
// Recharts 3 z-order is by `zIndex` (Bar default 300, Line default 400); we set both
// explicitly so the order never depends on defaults or child order.
export const BAR_Z_INDEX = 300;
export const HALO_Z_INDEX = 390;
export const LINE_Z_INDEX = 400;

const LINE_STROKE = '#111827';

export const trendDot = { r: 3.5, fill: LINE_STROKE, stroke: '#fff', strokeWidth: 1.5 } as const;

export function trendLineProps() {
  return {
    type: 'monotone' as const,
    stroke: LINE_STROKE,
    strokeWidth: 2,
    strokeDasharray: '5 3',
    dot: trendDot,
    connectNulls: false,
    zIndex: LINE_Z_INDEX,
  };
}

/** Spread onto a second <Line> with the same yAxisId/dataKey, rendered under the visible one. */
export function haloLineProps() {
  return {
    type: 'monotone' as const,
    stroke: '#fff',
    strokeWidth: 5,
    strokeDasharray: undefined,
    dot: false as const,
    activeDot: false as const,
    legendType: 'none' as const,
    tooltipType: 'none' as const,
    connectNulls: false,
    isAnimationActive: false,
    zIndex: HALO_Z_INDEX,
  };
}
