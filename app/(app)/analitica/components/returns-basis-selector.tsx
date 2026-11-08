'use client';

import type { ReturnsBasis } from '../types';
import { RETURNS_BASIS_LABEL } from '../lib/net-sales';

export default function ReturnsBasisSelector({
  value,
  onChange,
}: {
  value: ReturnsBasis;
  onChange: (b: ReturnsBasis) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Devoluciones</span>
      <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Fecha de atribución de devoluciones">
        {(['factura', 'devolucion'] as const).map(b => (
          <button
            key={b}
            onClick={() => onChange(b)}
            aria-pressed={value === b}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              value === b ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {RETURNS_BASIS_LABEL[b]}
          </button>
        ))}
      </div>
    </div>
  );
}
