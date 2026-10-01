// Single-hue sequential scale (blue-100 → blue-900). A numeric legend is
// always rendered next to it, so colour is never the only carrier of the value.
const LOW: [number, number, number] = [219, 234, 254];
const HIGH: [number, number, number] = [30, 58, 138];

export interface Scale {
  min: number;
  max: number;
  breaks: number[];
  colorFor(value: number): string;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

function mix(t: number): string {
  const c = LOW.map((lo, i) => lo + (HIGH[i] - lo) * t);
  return `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`;
}

export function buildScale(values: number[], steps = 5): Scale {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const t = (v: number) => (max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  const breaks = max === min ? [min] : Array.from({ length: steps }, (_, i) => min + ((max - min) * i) / (steps - 1));
  return { min, max, breaks, colorFor: v => mix(t(v)) };
}
