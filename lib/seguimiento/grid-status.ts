// Pure status rules for the Seguimiento grid. Status is never colour-only:
// every level carries an icon and a label next to its colours.

export type GridLevel = 'ok' | 'warn' | 'bad' | 'none';

export interface GridStatus {
  level: GridLevel;
  icon: '✓' | '!' | '✕' | '–';
  label: 'En meta' | 'Cerca' | 'Bajo meta' | 'Sin meta';
}

const NONE: GridStatus = { level: 'none', icon: '–', label: 'Sin meta' };

export function gridStatus(projected: number | null, goal: number | null): GridStatus {
  if (goal === null || !Number.isFinite(goal) || goal <= 0) return NONE;
  if (projected === null || !Number.isFinite(projected)) return NONE;
  const ratio = projected / goal;
  if (ratio >= 1) return { level: 'ok', icon: '✓', label: 'En meta' };
  if (ratio >= 0.85) return { level: 'warn', icon: '!', label: 'Cerca' };
  return { level: 'bad', icon: '✕', label: 'Bajo meta' };
}

type Pair = { fg: string; bg: string };

// Every pair is checked >= 4.5:1 (WCAG AA) in grid-status.test.ts.
export const STATUS_STYLES: Record<GridLevel, { light: Pair; dark: Pair }> = {
  ok: { light: { fg: '#14532d', bg: '#dcfce7' }, dark: { fg: '#bbf7d0', bg: '#14532d' } },
  warn: { light: { fg: '#713f12', bg: '#fef3c7' }, dark: { fg: '#fde68a', bg: '#78350f' } },
  bad: { light: { fg: '#7f1d1d', bg: '#fee2e2' }, dark: { fg: '#fecaca', bg: '#7f1d1d' } },
  none: { light: { fg: '#374151', bg: '#f3f4f6' }, dark: { fg: '#d1d5db', bg: '#374151' } },
};

function channels(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
