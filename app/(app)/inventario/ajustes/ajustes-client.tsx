'use client';

import { useState, useEffect, useMemo } from 'react';

interface Item {
  coArt:  string;
  artDes: string;
  coAlma: string;
  stock:  number;
}

interface AdjustmentResult {
  ajueNum: string;
  delta:   number;
}

export function AjustesClient() {
  const [items, setItems]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState('');
  const [countedStock, setCountedStock] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdjustmentResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const res = await fetch('/api/inventory/items');
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(data.error ?? 'No se pudo cargar la lista de artículos');
          return;
        }
        const data: Item[] = await res.json();
        if (cancelled) return;
        setItems(data);
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function rowKey(item: Item): string {
    return `${item.coArt}::${item.coAlma}`;
  }

  const selected = useMemo(
    () => items.find(item => rowKey(item) === selectedKey) ?? null,
    [items, selectedKey],
  );

  const countedValue = countedStock === '' ? null : Number(countedStock);
  const delta = selected && countedValue !== null && isFinite(countedValue)
    ? countedValue - selected.stock
    : null;

  async function handleSubmit() {
    if (!selected || countedValue === null || !isFinite(countedValue)) return;

    setSubmitting(true);
    setFormError(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          coArt:        selected.coArt,
          coAlma:       selected.coAlma,
          countedStock: countedValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? 'No se pudo registrar el ajuste');
        return;
      }

      setItems(prev => prev.map(item => rowKey(item) === selectedKey
        ? { ...item, stock: countedValue }
        : item,
      ));
      setLastResult({ ajueNum: data.ajueNum, delta: data.delta });
      setCountedStock('');
    } catch {
      setFormError('No se pudo conectar con el servidor');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando artículos…</div>;
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ajustes por Conteo Manual</h1>
      <p className="text-sm text-gray-500">
        Registra el stock físicamente contado de un artículo. El sistema calcula la diferencia
        contra el stock actual en Profit Plus y registra un ajuste de sobrante o faltante según corresponda.
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {loadError}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Artículo / Almacén</label>
          <select
            value={selectedKey}
            onChange={e => { setSelectedKey(e.target.value); setLastResult(null); setFormError(null); }}
            className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccione un artículo…</option>
            {items.map(item => (
              <option key={rowKey(item)} value={rowKey(item)}>
                {item.coArt} — {item.artDes} (almacén {item.coAlma})
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            <div className="text-sm text-gray-700">
              Stock actual en Profit Plus: <span className="font-semibold">{selected.stock}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock contado</label>
              <input
                type="number"
                value={countedStock}
                onChange={e => { setCountedStock(e.target.value); setLastResult(null); setFormError(null); }}
                className="w-40 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {delta !== null && delta !== 0 && (
              <p className="text-sm text-gray-600">
                {delta > 0
                  ? <>Se registrará un <span className="font-semibold text-green-700">sobrante de {delta}</span>.</>
                  : <>Se registrará un <span className="font-semibold text-red-700">faltante de {Math.abs(delta)}</span>.</>}
              </p>
            )}

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}

            {lastResult && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                Ajuste {lastResult.ajueNum} registrado
                ({lastResult.delta > 0 ? `sobrante de ${lastResult.delta}` : `faltante de ${Math.abs(lastResult.delta)}`}).
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || countedValue === null || !isFinite(countedValue) || delta === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
            >
              {submitting ? 'Registrando…' : 'Registrar Ajuste'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
