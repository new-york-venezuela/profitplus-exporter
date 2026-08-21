'use client';

import { useState, useEffect, useMemo } from 'react';

interface Item {
  coArt:       string;
  artDes:      string;
  ref:         string | null;
  modelo:      string | null;
  comentario:  string | null;
  stockMin:    number;
  stockMax:    number;
  stockPedido: number;
  coLin:       string;
  linDes:      string | null;
  coCat:       string;
  catDes:      string | null;
  coAlma:      string;
  stock:       number;
}

interface EditableFields {
  artDes:      string;
  ref:         string;
  modelo:      string;
  stockMin:    number;
  stockMax:    number;
  stockPedido: number;
}

function toEditable(item: Item): EditableFields {
  return {
    artDes:      item.artDes,
    ref:         item.ref ?? '',
    modelo:      item.modelo ?? '',
    stockMin:    item.stockMin,
    stockMax:    item.stockMax,
    stockPedido: item.stockPedido,
  };
}

export function ArticulosClient() {
  const [items, setItems]       = useState<Item[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lineaFilter, setLineaFilter] = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [edits, setEdits]       = useState<Record<string, EditableFields>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      const res = await fetch('/api/inventory/items');
      if (cancelled) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setLoadError(data.error ?? 'No se pudo cargar la lista de artículos');
        setLoading(false);
        return;
      }
      const data: Item[] = await res.json();
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const lineas = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) seen.set(item.coLin, item.linDes ?? item.coLin);
    return Array.from(seen.entries());
  }, [items]);

  const categorias = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) seen.set(item.coCat, item.catDes ?? item.coCat);
    return Array.from(seen.entries());
  }, [items]);

  const filteredItems = items.filter(item =>
    (lineaFilter === '' || item.coLin === lineaFilter) &&
    (catFilter === '' || item.coCat === catFilter),
  );

  // saArticulo fields are shared across every warehouse row of the same
  // article, but the table renders one row per (coArt, coAlma) — an
  // article stocked in two configured warehouses gets two rows. Edit/dirty/
  // error/saving state is keyed by rowKey (not coArt alone) so editing one
  // row never marks its sibling rows as dirty or independently saveable.
  function rowKey(item: Item): string {
    return `${item.coArt}::${item.coAlma}`;
  }

  function getEdits(item: Item): EditableFields {
    return edits[rowKey(item)] ?? toEditable(item);
  }

  function setField(item: Item, field: keyof EditableFields, value: string | number) {
    const key = rowKey(item);
    setEdits(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? toEditable(item)), [field]: value },
    }));
  }

  async function handleSave(item: Item) {
    const key = rowKey(item);
    setSavingRow(key);
    setRowErrors(prev => ({ ...prev, [key]: '' }));

    const fields = getEdits(item);
    const res = await fetch(`/api/inventory/items/${encodeURIComponent(item.coArt)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        art_des:      fields.artDes,
        ref:          fields.ref || null,
        modelo:       fields.modelo || null,
        stock_min:    fields.stockMin,
        stock_max:    fields.stockMax,
        stock_pedido: fields.stockPedido,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRowErrors(prev => ({ ...prev, [key]: data.error ?? 'No se pudo guardar' }));
      setSavingRow(null);
      return;
    }

    // These fields live on saArticulo, shared across every warehouse row
    // of this article — update all of them, not just the edited row.
    setItems(prev => prev.map(i => i.coArt === item.coArt
      ? { ...i, artDes: fields.artDes, ref: fields.ref || null, modelo: fields.modelo || null,
          stockMin: fields.stockMin, stockMax: fields.stockMax, stockPedido: fields.stockPedido }
      : i,
    ));
    setEdits(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSavingRow(null);
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando artículos…</div>;
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Artículos</h1>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {loadError}
        </p>
      )}

      <div className="flex gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Línea</label>
          <select value={lineaFilter} onChange={e => setLineaFilter(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">Todas</option>
            {lineas.map(([co, des]) => <option key={co} value={co}>{des}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">Todas</option>
            {categorias.map(([co, des]) => <option key={co} value={co}>{des}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Código', 'Nombre', 'Referencia', 'Modelo', 'Stock', 'Mín', 'Máx', 'Pedido', 'Acciones'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map(item => {
              const key = rowKey(item);
              const fields = getEdits(item);
              const dirty = !!edits[key];
              return (
                <tr key={key} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{item.coArt}</td>
                  <td className="px-3 py-2">
                    <input value={fields.artDes} onChange={e => setField(item, 'artDes', e.target.value)} className={inputClass} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={fields.ref} onChange={e => setField(item, 'ref', e.target.value)} className={`${inputClass} w-28`} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={fields.modelo} onChange={e => setField(item, 'modelo', e.target.value)} className={`${inputClass} w-28`} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.stock}</td>
                  <td className="px-3 py-2">
                    <input type="number" value={fields.stockMin}
                      onChange={e => setField(item, 'stockMin', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={fields.stockMax}
                      onChange={e => setField(item, 'stockMax', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={fields.stockPedido}
                      onChange={e => setField(item, 'stockPedido', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={!dirty || savingRow === key}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md disabled:opacity-40 whitespace-nowrap"
                    >
                      {savingRow === key ? 'Guardando…' : 'Guardar'}
                    </button>
                    {rowErrors[key] && (
                      <p className="text-xs text-red-600 mt-1 max-w-xs">{rowErrors[key]}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No hay artículos que coincidan con el filtro seleccionado.
          </div>
        )}
      </div>
    </div>
  );
}
