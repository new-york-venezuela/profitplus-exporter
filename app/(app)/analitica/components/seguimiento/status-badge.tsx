import type { CSSProperties } from 'react';
import { STATUS_STYLES, type GridStatus } from '@/lib/seguimiento/grid-status';

// Icon + label, never colour alone. Colours come from STATUS_STYLES (each pair checked >= 4.5:1) through CSS
// variables, so the `dark:` variant can swap to the dark pair without a second render.
export function StatusBadge({ status, title }: { status: GridStatus; title?: string }) {
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
