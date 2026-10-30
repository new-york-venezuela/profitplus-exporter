import type { CSSProperties } from 'react';
import { gridStatus, STATUS_STYLES, type GridStatus } from '@/lib/seguimiento/grid-status';

export type BadgeStatus = Pick<GridStatus, 'level' | 'icon'> & { label: GridStatus['label'] | 'Sin datos' };

// gridStatus, except that a real goal with no projection (e.g. no USD rate) is missing data, not a missing goal.
export function goalStatus(projected: number | null | undefined, goal: number | null | undefined): BadgeStatus {
  const hasGoal = goal != null && Number.isFinite(goal) && goal > 0;
  if (hasGoal && (projected == null || !Number.isFinite(projected))) return { level: 'none', icon: '–', label: 'Sin datos' };
  return gridStatus(projected ?? null, goal ?? null);
}

// Icon + label, never colour alone. Colours come from STATUS_STYLES (each pair checked >= 4.5:1) through CSS
// variables, so the `dark:` variant can swap to the dark pair without a second render.
export function StatusBadge({ status, title }: { status: BadgeStatus; title?: string }) {
  const s = STATUS_STYLES[status.level];
  const style = {
    '--st-fg': s.light.fg, '--st-bg': s.light.bg, '--st-fg-dark': s.dark.fg, '--st-bg-dark': s.dark.bg,
  } as CSSProperties;
  return (
    <span
      data-testid="grid-status"
      data-level={status.level}
      title={title}
      style={style}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--st-fg)] bg-[var(--st-bg)] dark:text-[var(--st-fg-dark)] dark:bg-[var(--st-bg-dark)]"
    >
      <span aria-hidden="true">{status.icon}</span>
      <span>{status.label}</span>
    </span>
  );
}

// Caveat shown beside a goal status, as the old quota bars did: a goal shared by several roots, or a sum that
// misses some seller's goal. Shared wins over partial.
export function quotaNote(shared: boolean | undefined, partial: boolean | undefined): string | null {
  if (shared) return 'Meta compartida';
  if (partial) return 'Meta parcial';
  return null;
}
