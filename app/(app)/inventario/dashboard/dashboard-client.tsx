'use client';

import { useState, useEffect } from 'react';

interface LowStockItem {
  coArt:         string;
  artDes:        string;
  coAlma:        string;
  stock:         number;
  sold:          number;
  avgDailySales: number;
  daysOfStock:   number;
}

interface StockRow {
  coArt:  string;
  artDes: string;
  coAlma: string;
  stock:  number;
}

interface DashboardResponse {
  items:                 LowStockItem[];
  allStock:              StockRow[];
  rollingWindowDays:     number;
  daysOfStockThreshold:  number;
}

export function DashboardClient() {
  const [data, setData]       = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch('/api/inventory/dashboard');
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.error ?? 'No se pudo cargar el panel de inventario');
          return;
        }
        const body: DashboardResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando panel de inventario…</div>;
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Artículos con Stock Bajo</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {data && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-gray-800">Stock actual</h2>
            <input
              type="text"
              placeholder="Buscar artículo…"
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm w-56
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  {['Código', 'Nombre', 'Almacén', 'Stock'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.allStock
                  .filter(row => {
                    const q = stockSearch.trim().toLowerCase();
                    return q === '' || row.coArt.toLowerCase().includes(q) || row.artDes.toLowerCase().includes(q);
                  })
                  .map(row => (
                    <tr key={`${row.coArt}::${row.coAlma}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{row.coArt}</td>
                      <td className="px-3 py-2 text-gray-900">{row.artDes}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.coAlma}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.stock}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {data.allStock.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">
                No hay artículos configurados para mostrar.
              </div>
            )}
          </div>
        </div>
      )}

      {data && (
        <>
          <p className="text-sm text-gray-500">
            Artículos con menos de {data.daysOfStockThreshold} días de stock estimado, según
            el promedio de ventas diarias de los últimos {data.rollingWindowDays} días.
            Artículos sin ventas recientes no aparecen aquí.
          </p>

          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Código', 'Nombre', 'Almacén', 'Stock', 'Venta diaria prom.', 'Días de stock'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(item => (
                  <tr key={`${item.coArt}::${item.coAlma}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.coArt}</td>
                    <td className="px-3 py-2 text-gray-900">{item.artDes}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.coAlma}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.stock}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.avgDailySales.toFixed(1)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.stock < 0 ? (
                        <span className="font-semibold text-gray-400" title="Stock negativo en Profit Plus — este valor no refleja stock físico real">
                          {item.daysOfStock.toFixed(1)} (stock negativo)
                        </span>
                      ) : (
                        <span className={`font-semibold ${item.daysOfStock <= 0 ? 'text-red-700' : 'text-orange-600'}`}>
                          {item.daysOfStock.toFixed(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">
                No hay artículos con stock bajo en este momento.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
