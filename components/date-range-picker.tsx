'use client';

interface Props {
  startDate:     string;
  endDate:       string;
  onStartChange: (date: string) => void;
  onEndChange:   (date: string) => void;
  onApply:       () => void;
  loading:       boolean;
}

export function DateRangePicker({
  startDate, endDate, onStartChange, onEndChange, onApply, loading,
}: Props) {
  const invalid = !!startDate && !!endDate && startDate > endDate;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-600">Período</span>

      <input
        type="date"
        value={startDate}
        onChange={e => onStartChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <span className="text-gray-400 text-sm">→</span>

      <input
        type="date"
        value={endDate}
        onChange={e => onEndChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        onClick={onApply}
        disabled={invalid || loading}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                   font-medium rounded-md transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Cargando…' : 'Aplicar'}
      </button>

      {invalid && (
        <span className="text-xs text-red-500">
          La fecha inicial debe ser ≤ fecha final
        </span>
      )}
    </div>
  );
}
