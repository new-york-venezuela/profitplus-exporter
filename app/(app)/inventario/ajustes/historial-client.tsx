'use client';

import { useState, useEffect } from 'react';

interface HistoryItem {
  ajueNum:  string;
  fecha:    string;
  coArt:    string;
  artDes:   string;
  coAlma:   string;
  tipo:     string;
  cantidad: number;
}

// reloadToken bump forces a refetch right after a new adjustment is
// submitted, without this component owning any of the create-form state.
export function HistorialClient({ reloadToken }: { reloadToken: number }) {
  const [items, setItems]     = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/inventory/adjustments/history?limit=20');
        if (cancelled) return;
        if (!res.ok) {
          setError('No se pudo cargar el historial de ajustes');
          return;
        }
        setItems(await res.json());
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reloadToken]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">Últimos ajustes</h2>
      </div>

      {loading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}

      {error && (
        <p className="m-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {!loading && !error && (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['N° Ajuste', 'Fecha', 'Artículo', 'Almacén', 'Tipo', 'Cantidad'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={`${item.ajueNum}::${item.coArt}::${item.coAlma}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.ajueNum}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{new Date(item.fecha).toLocaleDateString('es-VE')}</td>
                <td className="px-3 py-2 text-gray-900">{item.coArt} — {item.artDes}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.coAlma}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {item.tipo === 'E00003'
                    ? <span className="text-green-700 font-medium">Sobrante</span>
                    : <span className="text-red-700 font-medium">Faltante</span>}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No hay ajustes registrados todavía.
        </div>
      )}
    </div>
  );
}
