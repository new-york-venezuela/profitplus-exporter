'use client';

import Link from 'next/link';
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
  const [showAddToWarehouse, setShowAddToWarehouse] = useState(false);
  const [warehouseCandidates, setWarehouseCandidates] = useState<Array<{ coArt: string; artDes: string }>>([]);
  const [addWarehouseTarget, setAddWarehouseTarget] = useState('');
  const [addArticleTarget, setAddArticleTarget] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

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

  const warehouseOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) seen.add(item.coAlma);
    return Array.from(seen);
  }, [items]);

  const filteredItems = items.filter(item =>
    (lineaFilter === '' || item.coLin === lineaFilter) &&
    (catFilter === '' || item.coCat === catFilter),
  );

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
    try {
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
        return;
      }

      setItems(prev => prev.map(i => i.coArt === item.coArt
        ? { ...i, artDes: fields.artDes, ref: fields.ref || null, modelo: fields.modelo || null,
            stockMin: fields.stockMin, stockMax: fields.stockMax, stockPedido: fields.stockPedido }
        : i,
      ));
      const siblingPrefix = `${item.coArt}::`;
      setEdits(prev => Object.fromEntries(
        Object.entries(prev).filter(([k]) => !k.startsWith(siblingPrefix)),
      ));
      setRowErrors(prev => Object.fromEntries(
        Object.entries(prev).filter(([k]) => !k.startsWith(siblingPrefix)),
      ));
    } catch {
      setRowErrors(prev => ({ ...prev, [key]: 'No se pudo conectar con el servidor' }));
    } finally {
      setSavingRow(null);
    }
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
          <label htmlFor="linea-filter" className="block text-xs font-medium text-gray-700 mb-1">Línea</label>
          <select id="linea-filter" value={lineaFilter} onChange={e => setLineaFilter(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">Todas</option>
            {lineas.map(([co, des]) => <option key={co} value={co}>{des}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cat-filter" className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
          <select id="cat-filter" value={catFilter} onChange={e => setCatFilter(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">Todas</option>
            {categorias.map(([co, des]) => <option key={co} value={co}>{des}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <button
          onClick={() => setShowAddToWarehouse(v => !v)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAddToWarehouse ? 'Cancelar' : '+ Agregar artículo existente a un almacén'}
        </button>

        {showAddToWarehouse && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">
              Para artículos que ya existen en Profit Plus pero aún no tienen stock
              registrado en un almacén configurado — por ejemplo, una línea de
              productos nueva.
            </p>
            <div className="flex gap-3 items-end">
              <div>
                <label htmlFor="add-warehouse-target" className="block text-xs font-medium text-gray-700 mb-1">Almacén</label>
                <select
                  id="add-warehouse-target"
                  value={addWarehouseTarget}
                  onChange={async e => {
                    const coAlma = e.target.value;
                    setAddWarehouseTarget(coAlma);
                    setAddArticleTarget('');
                    setAddError(null);
                    if (!coAlma) { setWarehouseCandidates([]); return; }
                    const res = await fetch(`/api/inventory/items?unstocked=true&co_alma=${encodeURIComponent(coAlma)}`);
                    setWarehouseCandidates(res.ok ? await res.json() : []);
                  }}
                  className={`${inputClass} w-48`}
                >
                  <option value="">Selecciona…</option>
                  {warehouseOptions.map(coAlma => <option key={coAlma} value={coAlma}>{coAlma}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="add-article-target" className="block text-xs font-medium text-gray-700 mb-1">Artículo</label>
                <select
                  id="add-article-target"
                  value={addArticleTarget}
                  onChange={e => setAddArticleTarget(e.target.value)}
                  disabled={!addWarehouseTarget}
                  className={inputClass}
                >
                  <option value="">Selecciona…</option>
                  {warehouseCandidates.map(c => <option key={c.coArt} value={c.coArt}>{c.coArt} — {c.artDes}</option>)}
                </select>
              </div>
              <button
                onClick={async () => {
                  setAdding(true);
                  setAddError(null);
                  try {
                    const res = await fetch(`/api/inventory/items/${encodeURIComponent(addArticleTarget)}/warehouses`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ coAlma: addWarehouseTarget }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      setAddError(data.error ?? 'No se pudo agregar el artículo al almacén');
                      return;
                    }
                    const listRes = await fetch('/api/inventory/items');
                    if (listRes.ok) setItems(await listRes.json());
                    setShowAddToWarehouse(false);
                    setAddWarehouseTarget('');
                    setAddArticleTarget('');
                  } finally {
                    setAdding(false);
                  }
                }}
                disabled={!addWarehouseTarget || !addArticleTarget || adding}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
              >
                {adding ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{addError}</p>
            )}
          </div>
        )}
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
                    <input aria-label={`Nombre ${item.coArt} (${item.coAlma})`} value={fields.artDes} onChange={e => setField(item, 'artDes', e.target.value)} className={inputClass} />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`Referencia ${item.coArt} (${item.coAlma})`} value={fields.ref} onChange={e => setField(item, 'ref', e.target.value)} className={`${inputClass} w-28`} />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`Modelo ${item.coArt} (${item.coAlma})`} value={fields.modelo} onChange={e => setField(item, 'modelo', e.target.value)} className={`${inputClass} w-28`} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.stock}</td>
                  <td className="px-3 py-2">
                    <input aria-label={`Mín ${item.coArt} (${item.coAlma})`} type="number" value={fields.stockMin}
                      onChange={e => setField(item, 'stockMin', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`Máx ${item.coArt} (${item.coAlma})`} type="number" value={fields.stockMax}
                      onChange={e => setField(item, 'stockMax', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={`Pedido ${item.coArt} (${item.coAlma})`} type="number" value={fields.stockPedido}
                      onChange={e => setField(item, 'stockPedido', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={!dirty || savingRow === key}
                      aria-label={`Guardar ${item.coArt} en almacén ${item.coAlma}`}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md disabled:opacity-40 whitespace-nowrap"
                    >
                      {savingRow === key ? 'Guardando…' : 'Guardar'}
                    </button>
                    {rowErrors[key] && (
                      <p className="text-xs text-red-600 mt-1 max-w-xs">{rowErrors[key]}</p>
                    )}
                    <Link
                      href={`/inventario/ajustes?co_art=${encodeURIComponent(item.coArt)}&co_alma=${encodeURIComponent(item.coAlma)}`}
                      className="block mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                    >
                      Ajustar stock →
                    </Link>
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
