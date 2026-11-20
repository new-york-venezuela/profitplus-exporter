'use client';

// Change vs the comparison period. No usable base (null or zero previous) is a muted "sin base": never 0%, never colored.
export function DeltaBadge({ current, previous, format = 'pct' }: {
  current: number | null;
  previous: number | null;
  format?: 'pct' | 'abs';
}) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-xs text-gray-600">sin base</span>;
  }
  const diff = current - previous;
  const value = format === 'pct' ? (diff / Math.abs(previous)) * 100 : diff;
  const up = diff >= 0;
  const magnitude = format === 'pct' ? `${Math.abs(value).toFixed(1)}%` : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(Math.abs(value));
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-700' : 'text-red-700'}`}>
      {up ? '▲ +' : '▼ −'}{magnitude}
    </span>
  );
}
