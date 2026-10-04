export function KpiCard({
  label,
  value,
  tone,
  delta,
  subtitle,
  title,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
  delta?: { pct: number | null; label: string; goodDirection?: 'up' | 'down' };
  subtitle?: string;
  title?: string;
}) {
  const isGood =
    delta && delta.pct !== null && ((delta.goodDirection ?? 'up') === 'up' ? delta.pct >= 0 : delta.pct <= 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" title={title}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {subtitle && <p className="text-xs mt-1 text-gray-500">{subtitle}</p>}
      {delta && (
        <p className={`text-xs mt-1 font-medium ${delta.pct === null ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct === null ? '—' : `${delta.pct >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct * 100).toFixed(1)}%`} {delta.label}
        </p>
      )}
    </div>
  );
}
