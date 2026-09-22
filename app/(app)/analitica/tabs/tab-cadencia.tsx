'use client';

import { useEffect, useState } from 'react';
import type { CadenceResponse, CadenceRow, CustomerSegment, Currency, DateRange } from '../types';

function EmptyState() {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      Sin datos disponibles todavía.
    </div>
  );
}

const SEGMENT_OPTIONS: { value: CustomerSegment | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'CADENA', label: 'Cadena' },
  { value: 'INDEPENDIENTES', label: 'Independientes' },
];

export default function TabCadencia({ dateRange }: { dateRange: DateRange; currency: Currency }) {
  const [data, setData] = useState<CadenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'todos'>('todos');
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      // no-store: the route sends a 15-minute Cache-Control (shared by every
      // dwh/* route, to dedupe a tab-mount's burst of near-simultaneous
      // requests) — fine everywhere else, but this tab also reloads right
      // after saving a target via a mutating POST to a different endpoint,
      // and a same-URL GET within that window would otherwise serve the
      // pre-save cached response, showing a stale "Sin meta" after a save.
      const res = await fetch(`/api/dwh/cadencia?dateRange=${dateRange}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Error desconocido');
        return;
      }
      setData(await res.json());
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  async function saveTarget(row: CadenceRow) {
    const days = Number(editValue);
    if (!Number.isFinite(days) || days <= 0) return;
    setSaving(true);
    try {
      await fetch('/api/cadencia-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalEntityKey: row.legalEntityKey, targetGapDays: days }),
      });
      setEditingKey(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const rows = data.rows.filter(r => segmentFilter === 'todos' || r.segment === segmentFilter);

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Cadencia de compra</h2>
            <p className="text-xs text-gray-500">
              Frecuencia de compra por cliente — ventas como proxy de visitas
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Segmento:
            <select
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value as CustomerSegment | 'todos')}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              {SEGMENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días desde última compra</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Brecha promedio (días)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días con compra</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Meta (días)</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={row.legalEntityKey} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="px-3 py-2 text-gray-800">{row.legalEntityName}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{row.daysSinceLastPurchase}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.avgGapDays === null ? '—' : row.avgGapDays.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.purchaseDayCount}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {editingKey === row.legalEntityKey ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number" min={1} value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="border border-gray-200 rounded px-1 py-0.5 w-14 text-right"
                          />
                          <button disabled={saving} onClick={() => saveTarget(row)} className="text-blue-600 hover:text-blue-800 text-xs">
                            Guardar
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setEditingKey(row.legalEntityKey); setEditValue(String(row.targetGapDays ?? '')); }}
                          className="hover:text-blue-600 underline"
                        >
                          {row.targetGapDays === null ? 'Definir' : row.targetGapDays}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.isOverdue === null ? (
                        <span className="text-gray-400 text-xs">Sin meta</span>
                      ) : row.isOverdue ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Atrasado</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Al día</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
