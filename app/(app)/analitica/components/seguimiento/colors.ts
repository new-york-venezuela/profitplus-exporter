import { OTHER_LINE_LABEL } from '@/lib/seguimiento/category-mix';

// Same palette as tab-productos.tsx's LINEA_COLORS so a línea keeps its colour across tabs.
const LINE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#6b7280'];

export function lineColor(line: string, visible: readonly string[]): string {
  if (line === OTHER_LINE_LABEL) return '#9ca3af';
  const idx = visible.indexOf(line);
  return LINE_COLORS[(idx < 0 ? 0 : idx) % LINE_COLORS.length];
}
