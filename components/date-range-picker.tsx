'use client';

import { useState } from 'react';

interface Props {
  startDate: string;   // YYYY-MM-DD — initial value
  endDate:   string;   // YYYY-MM-DD — initial value
  onChange:  (startDate: string, endDate: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd,   setLocalEnd]   = useState(endDate);
  const [error,      setError]      = useState('');

  function handleApply() {
    if (localStart > localEnd) {
      setError('La fecha inicial debe ser anterior o igual a la fecha final');
      return;
    }
    setError('');
    onChange(localStart, localEnd);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-gray-600">Período</span>

      <input
        type="date"
        value={localStart}
        onChange={e => { setLocalStart(e.target.value); setError(''); }}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <span className="text-gray-400 text-sm">→</span>

      <input
        type="date"
        value={localEnd}
        onChange={e => { setLocalEnd(e.target.value); setError(''); }}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        onClick={handleApply}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                   font-medium rounded-md transition-colors"
      >
        Aplicar
      </button>

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
