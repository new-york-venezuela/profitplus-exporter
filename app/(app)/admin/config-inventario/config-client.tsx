'use client';

import { useState } from 'react';

interface Warehouse {
  id:     number;
  coAlma: string;
  label:  string;
  active: boolean;
}

interface Settings {
  id:                   number;
  rollingWindowDays:    number;
  daysOfStockThreshold: number;
}

interface Props {
  initialWarehouses: Warehouse[];
  initialSettings:   Settings;
}

export function ConfigInventarioClient({ initialWarehouses, initialSettings }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [settings, setSettings]     = useState<Settings>(initialSettings);
  const [newCoAlma, setNewCoAlma]   = useState('');
  const [newLabel, setNewLabel]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  async function handleAddWarehouse() {
    setError(null);
    const res = await fetch('/api/admin/inventory-warehouses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ coAlma: newCoAlma, label: newLabel }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    const listRes = await fetch('/api/admin/inventory-warehouses');
    if (listRes.ok) setWarehouses(await listRes.json());
    setNewCoAlma(''); setNewLabel('');
  }

  async function handleToggleActive(warehouse: Warehouse) {
    setError(null);
    const res = await fetch(`/api/admin/inventory-warehouses/${warehouse.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: !warehouse.active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo actualizar el almacén');
      return;
    }
    setWarehouses(prev => prev.map(w => w.id === warehouse.id ? { ...w, active: !w.active } : w));
  }

  async function handleDeleteWarehouse(id: number) {
    if (!confirm('¿Eliminar este almacén de la lista?')) return;
    const res = await fetch(`/api/admin/inventory-warehouses/${id}`, { method: 'DELETE' });
    if (res.ok) setWarehouses(prev => prev.filter(w => w.id !== id));
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory-settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rollingWindowDays: settings.rollingWindowDays,
          daysOfStockThreshold: settings.daysOfStockThreshold,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración de Inventario</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Almacenes</h2>
        <p className="text-sm text-gray-500 mb-4">
          Almacenes de Profit Plus que el módulo de Inventario debe mostrar.
          Si esta lista está vacía, el módulo muestra todos los almacenes con
          stock registrado.
        </p>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Código', 'Nombre', 'Activo', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {warehouses.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{w.coAlma}</td>
                  <td className="px-4 py-3 text-gray-700">{w.label}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={w.active}
                      onChange={() => handleToggleActive(w)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteWarehouse(w.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {warehouses.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              No hay almacenes configurados — se mostrarán todos los almacenes con stock.
            </div>
          )}
        </div>

        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código (co_alma)</label>
            <input value={newCoAlma} onChange={e => setNewCoAlma(e.target.value)} className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={handleAddWarehouse}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
          >
            + Agregar
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Alertas de stock bajo</h2>
        <div className="flex gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ventana de consumo (días)
            </label>
            <input
              type="number"
              min={1}
              value={settings.rollingWindowDays}
              onChange={e => setSettings(s => ({ ...s, rollingWindowDays: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Días de stock mínimo para alertar
            </label>
            <input
              type="number"
              min={1}
              value={settings.daysOfStockThreshold}
              onChange={e => setSettings(s => ({ ...s, daysOfStockThreshold: parseInt(e.target.value, 10) || 0 }))}
              className={`${inputClass} w-32`}
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {savingSettings ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
    </div>
  );
}
