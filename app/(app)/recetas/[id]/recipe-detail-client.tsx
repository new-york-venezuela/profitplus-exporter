'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Line {
  id?: number;
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  manualLabel: string | null;
  quantity: number;
  unit: string;
  manualUnitCostUsd: number | null;
}

interface RecipeDetail {
  id: number;
  coArt: string;
  label: string;
  active: boolean;
  lines: Line[];
}

interface ArticleOption {
  coArt: string;
  artDes: string;
  unidad: string | null;
}

interface CostLineResult {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  costUsd: number | null;
  estimated: boolean;
}

interface CostResult {
  totalUsd: number;
  lines: CostLineResult[];
  asOfRateDate: string | null;
  incomplete: boolean;
}

function emptyErpLine(): Line {
  return { lineType: 'erp_article', coArt: '', manualLabel: null, quantity: 0, unit: 'KG', manualUnitCostUsd: null };
}

function emptyManualLine(): Line {
  return { lineType: 'manual', coArt: null, manualLabel: '', quantity: 0, unit: 'LTS', manualUnitCostUsd: 0 };
}

export function RecipeDetailClient({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  const loadCost = useCallback(async () => {
    setCostLoading(true);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}/cost`);
      if (res.ok) setCost(await res.json());
    } finally {
      setCostLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [recipeRes, itemsRes] = await Promise.all([
          fetch(`/api/recetas/recipes/${recipeId}`),
          fetch('/api/inventory/items'),
        ]);
        if (cancelled) return;
        if (!recipeRes.ok) {
          setLoadError('No se pudo cargar la receta');
          return;
        }
        const recipeData: RecipeDetail = await recipeRes.json();
        setRecipe(recipeData);
        setLines(recipeData.lines);
        if (itemsRes.ok) {
          const items: { coArt: string; artDes: string; unidad: string | null }[] = await itemsRes.json();
          setArticles(items);
        }
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [recipeId]);

  useEffect(() => {
    if (recipe) loadCost();
  }, [recipe, loadCost]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!recipe) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: recipe.label, active: recipe.active, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? 'No se pudo guardar la receta');
        return;
      }
      await loadCost();
    } catch {
      setSaveError('No se pudo conectar con el servidor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta receta?')) return;
    const res = await fetch(`/api/recetas/recipes/${recipeId}`, { method: 'DELETE' });
    if (res.ok) router.push('/recetas');
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando receta…</div>;
  if (loadError || !recipe) {
    return <div className="p-6 text-sm text-red-600">{loadError ?? 'Receta no encontrada'}</div>;
  }

  const inputClass = `border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{recipe.coArt} — {recipe.label}</h1>
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">Eliminar receta</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Insumos</h2>

        {lines.map((line, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-3">
            {line.lineType === 'erp_article' ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Artículo</label>
                <select
                  value={line.coArt ?? ''}
                  onChange={e => updateLine(index, { coArt: e.target.value })}
                  className={`${inputClass} min-w-[16rem]`}
                >
                  <option value="">Selecciona…</option>
                  {articles.map(a => (
                    <option key={a.coArt} value={a.coArt}>{a.coArt} — {a.artDes}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Insumo (manual)</label>
                <input
                  type="text"
                  value={line.manualLabel ?? ''}
                  onChange={e => updateLine(index, { manualLabel: e.target.value })}
                  placeholder="Ej: Agua"
                  className={`${inputClass} min-w-[12rem]`}
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
              <input
                type="number"
                step="any"
                value={line.quantity}
                onChange={e => updateLine(index, { quantity: Number(e.target.value) })}
                className={`${inputClass} w-24`}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Unidad</label>
              <input
                type="text"
                value={line.unit}
                onChange={e => updateLine(index, { unit: e.target.value })}
                className={`${inputClass} w-20`}
              />
            </div>

            {line.lineType === 'manual' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Costo USD / unidad</label>
                <input
                  type="number"
                  step="any"
                  value={line.manualUnitCostUsd ?? 0}
                  onChange={e => updateLine(index, { manualUnitCostUsd: Number(e.target.value) })}
                  className={`${inputClass} w-28`}
                />
              </div>
            )}

            <button onClick={() => removeLine(index)} className="text-sm text-red-600 hover:underline pb-1">Quitar</button>
          </div>
        ))}

        <div className="flex gap-2">
          <button onClick={() => setLines(prev => [...prev, emptyErpLine()])} className="text-sm text-blue-600 hover:underline">
            + Insumo de Profit Plus
          </button>
          <button onClick={() => setLines(prev => [...prev, emptyManualLine()])} className="text-sm text-blue-600 hover:underline">
            + Insumo manual
          </button>
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar Receta'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Costo de Fabricación (en vivo)</h2>
        {costLoading && <p className="text-sm text-gray-500">Calculando…</p>}
        {!costLoading && cost && (
          <>
            <p className="text-3xl font-bold text-gray-900">${cost.totalUsd.toFixed(4)}</p>
            {cost.incomplete && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Este costo es incompleto o estimado — algún insumo no tiene suficiente historial de compras en Profit Plus.
              </p>
            )}
            <table className="min-w-full text-sm mt-2">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Insumo', 'Cantidad', 'Costo USD', ''].map(h => (
                    <th key={h} className="px-2 py-1 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cost.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{l.coArt ?? lines[i]?.manualLabel ?? '—'}</td>
                    <td className="px-2 py-1">{l.quantity}</td>
                    <td className="px-2 py-1">{l.costUsd === null ? 'Sin datos' : `$${l.costUsd.toFixed(4)}`}</td>
                    <td className="px-2 py-1 text-xs text-amber-700">{l.estimated ? 'Estimado' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
