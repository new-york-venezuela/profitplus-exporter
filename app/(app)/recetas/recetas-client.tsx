'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface RecipeRow {
  id: number;
  coArt: string;
  label: string;
  active: boolean;
}

interface ArticleOption {
  coArt: string;
  artDes: string;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function RecetasClient() {
  const [recipeList, setRecipeList] = useState<RecipeRow[]>([]);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [newCoArt, setNewCoArt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadRecipes() {
    const res = await fetch('/api/recetas/recipes');
    if (res.ok) setRecipeList(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [recipesRes, itemsRes] = await Promise.all([
          fetch('/api/recetas/recipes'),
          fetch('/api/inventory/items'),
        ]);
        if (cancelled) return;
        if (!recipesRes.ok || !itemsRes.ok) {
          setLoadError('No se pudo cargar la información');
          return;
        }
        setRecipeList(await recipesRes.json());
        const items: { coArt: string; artDes: string }[] = await itemsRes.json();
        setArticles(items.map(i => ({ coArt: i.coArt, artDes: i.artDes })));
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const recipeCoArts = useMemo(() => new Set(recipeList.map(r => r.coArt)), [recipeList]);
  const availableArticles = useMemo(
    () => articles.filter(a => !recipeCoArts.has(a.coArt)),
    [articles, recipeCoArts],
  );

  const filteredRecipes = useMemo(() => {
    const q = normalize(search.trim());
    if (q === '') return recipeList;
    return recipeList.filter(r => normalize(r.coArt).includes(q) || normalize(r.label).includes(q));
  }, [recipeList, search]);

  async function handleCreate() {
    const article = availableArticles.find(a => a.coArt === newCoArt);
    if (!article) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/recetas/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coArt: article.coArt, label: article.artDes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? 'No se pudo crear la receta');
        return;
      }
      setNewCoArt('');
      await loadRecipes();
    } catch {
      setCreateError('No se pudo conectar con el servidor');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando recetas…</div>;
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
      <p className="text-sm text-gray-500">
        Define la receta de un producto terminado para ver su costo de fabricación,
        calculado en vivo con el método PEPS sobre las capas de costo de Profit Plus.
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{loadError}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <label htmlFor="new-recipe-article" className="block text-xs font-medium text-gray-700">
          Crear receta para un producto
        </label>
        <div className="flex gap-2">
          <select
            id="new-recipe-article"
            value={newCoArt}
            onChange={e => { setNewCoArt(e.target.value); setCreateError(null); }}
            className={`${inputClass} max-w-md`}
          >
            <option value="">Selecciona un producto…</option>
            {availableArticles.map(a => (
              <option key={a.coArt} value={a.coArt}>{a.coArt} — {a.artDes}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newCoArt}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40 whitespace-nowrap"
          >
            {creating ? 'Creando…' : 'Crear Receta'}
          </button>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </div>

      <div>
        <label htmlFor="recetas-search" className="block text-xs font-medium text-gray-700 mb-1">Buscar receta</label>
        <input
          id="recetas-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Código o nombre…"
          className={`${inputClass} max-w-sm`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {['Código', 'Producto', 'Estado', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecipes.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{r.coArt}</td>
                <td className="px-3 py-2 text-gray-900">{r.label}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.active ? 'Activa' : 'Inactiva'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/recetas/${r.id}`} className="text-blue-600 hover:underline">Editar / Costo</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecipes.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No hay recetas registradas todavía.</div>
        )}
      </div>
    </div>
  );
}
