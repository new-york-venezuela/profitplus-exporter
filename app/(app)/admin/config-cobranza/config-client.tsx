'use client';

import { useState } from 'react';

interface Settings {
  id:            number;
  thresholdDays: number;
}

interface Props {
  initialSettings: Settings;
}

export function ConfigCobranzaClient({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config-cobranza', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ thresholdDays: settings.thresholdDays }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error desconocido' }));
        setError(data.error);
      } else {
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración de Cobranza</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recordatorios de facturas</h2>
        <div className="flex gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Días de anticipación
            </label>
            <input
              type="number"
              min={1}
              value={settings.thresholdDays}
              onChange={e => setSettings(s => ({ ...s, thresholdDays: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
            <p className="text-xs text-gray-500 mt-1 max-w-64">
              Cuántos días antes del vencimiento se incluye una factura en el
              recordatorio diario por correo. Ej.: 3.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span className="text-sm text-green-600 self-center">Guardado</span>}
        </div>
      </section>
    </div>
  );
}
