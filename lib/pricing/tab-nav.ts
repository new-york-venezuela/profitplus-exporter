/** Roving-tabindex keyboard navigation for a horizontal tablist (wraps around). */
export function nextTabId(ids: string[], current: string, key: string): string | null {
  const i = ids.indexOf(current);
  if (i === -1 || ids.length === 0) return null;
  if (key === 'ArrowRight') return ids[(i + 1) % ids.length];
  if (key === 'ArrowLeft') return ids[(i - 1 + ids.length) % ids.length];
  if (key === 'Home') return ids[0];
  if (key === 'End') return ids[ids.length - 1];
  return null;
}
