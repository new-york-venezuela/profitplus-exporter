'use client';

import { useState, useEffect, useMemo } from 'react';
import { HistorialClient } from './historial-client';

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

interface Props {
  initialCoArt?: string;
  initialCoAlma?: string;
}

function rowKey(item: Item): string {
  return `${item.coArt}::${item.coAlma}`;
}

// Case- and accent-insensitive so "camara" matches "Cámara" — Spanish
// article names routinely carry accents a user won't bother typing.
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchesSearch(item: Item, query: string): boolean {
  const q = normalize(query.trim());
  if (q === '') return true;
  return normalize(item.coArt).includes(q) || normalize(item.artDes).includes(q);
}

export function AjustesClient({ initialCoArt, initialCoAlma }: Props) {
  const [items, setItems]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch]           = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [countedStock, setCountedStock] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdjustmentResult | null>(null);
  const [historyReloadToken, setHistoryReloadToken] = useState(0);

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

  const filteredItems = useMemo(
    () => items.filter(item => matchesSearch(item, search)),
    [items, search],
  );

  // The URL-preselected article (if any) is derived during render rather
  // than copied into state via an effect: selectedKey stays empty until
  // the user explicitly picks a row (handleSelectRow), and effectiveKey
  // falls back to the URL params only while that hasn't happened yet, so
  // an explicit selection always wins even if it later differs from the
  // URL. This avoids the react-hooks/set-state-in-effect cascading-render
  // pattern an effect-based version of this preselection would trigger.
  const initialKey = initialCoArt && initialCoAlma ? `${initialCoArt}::${initialCoAlma}` : '';
  const effectiveKey = selectedKey || initialKey;

  const selected = useMemo(
    () => items.find(item => rowKey(item) === effectiveKey) ?? null,
    [items, effectiveKey],
  );

  function handleSelectRow(item: Item) {
    setSelectedKey(rowKey(item));
    setCountedStock('');
    setLastResult(null);
    setFormError(null);
  }

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

      setItems(prev => prev.map(item => rowKey(item) === effectiveKey
        ? { ...item, stock: countedValue }
        : item,
      ));
      setLastResult({ ajueNum: data.ajueNum, delta: data.delta });
      setHistoryReloadToken(t => t + 1);
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

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ajustes por Conteo Manual</h1>
      <p className="text-sm text-gray-500">
        Busca un artículo, selecciónalo de la tabla y registra el stock físicamente contado.
        El sistema calcula la diferencia contra el stock actual en Profit Plus y registra un
        ajuste de sobrante o faltante según corresponda.
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {loadError}
        </p>
      )}

      <div>
        <label htmlFor="ajustes-search" className="block text-xs font-medium text-gray-700 mb-1">
          Buscar artículo
        </label>
        <input
          id="ajustes-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Código o nombre…"
          className={`${inputClass} max-w-sm`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
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
          <tbody className="divide-y divide-gray-100" role="listbox" aria-label="Artículos">
            {filteredItems.map(item => {
              const key = rowKey(item);
              const isSelected = key === effectiveKey;
              return (
                <tr
                  key={key}
                  onClick={() => handleSelectRow(item)}
                  role="option"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRow(item); } }}
                  aria-selected={isSelected}
                  className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.coArt}</td>
                  <td className="px-3 py-2 text-gray-900">{item.artDes}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.coAlma}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.stock}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No hay artículos que coincidan con la búsqueda.
          </div>
        )}
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="text-sm text-gray-700">
            Ajustando <span className="font-semibold">{selected.coArt} — {selected.artDes}</span> en
            almacén <span className="font-semibold">{selected.coAlma}</span>.
            Stock actual en Profit Plus: <span aria-label="Stock actual" className="font-semibold">{selected.stock}</span>
          </div>

          <div>
            <label htmlFor="stock-contado" className="block text-xs font-medium text-gray-700 mb-1">Stock contado</label>
            <input
              id="stock-contado"
              type="number"
              value={countedStock}
              onChange={e => { setCountedStock(e.target.value); setLastResult(null); setFormError(null); }}
              className={`${inputClass} w-40`}
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
        </div>
      )}

      <HistorialClient reloadToken={historyReloadToken} />
    </div>
  );
}
