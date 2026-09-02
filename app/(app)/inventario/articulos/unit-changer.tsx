'use client';

import { useState } from 'react';

interface Unit {
  coUni: string;
  desUni: string;
}

interface UnitChangerProps {
  coArt: string;
  artDes: string;
  currentUnit: string | null;
  units: Unit[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUnit: string) => void;
}

export function UnitChanger({
  coArt, artDes, currentUnit, units, isOpen, onClose, onSuccess,
}: UnitChangerProps) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedUnit) {
      setError('Selecciona una unidad');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/items/${encodeURIComponent(coArt)}/unit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ coUniNueva: selectedUnit }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'No se pudo cambiar la unidad');
        return;
      }

      onSuccess(selectedUnit);
      setSelectedUnit('');
      onClose();
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Cambiar unidad de {coArt}</h2>

        <div>
          <p className="text-sm text-gray-600 mb-2">Artículo: <span className="font-medium">{artDes}</span></p>
          <p className="text-sm text-gray-600 mb-3">Unidad actual: <span className="font-medium">{currentUnit || '—'}</span></p>
        </div>

        <div>
          <label htmlFor="unit-select" className="block text-xs font-medium text-gray-700 mb-1">Nueva unidad</label>
          <select
            id="unit-select"
            value={selectedUnit}
            onChange={e => { setSelectedUnit(e.target.value); setError(null); }}
            className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona…</option>
            {units.map(u => (
              <option key={u.coUni} value={u.coUni}>{u.desUni} ({u.coUni})</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedUnit}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
          >
            {submitting ? 'Cambiando…' : 'Cambiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
