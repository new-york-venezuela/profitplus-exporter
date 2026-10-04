'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchableSelect } from '@/components/searchable-select';
import { CostBadge, StatusBadge } from './recipe-ui';

interface RecipeRow {
  id: number;
  coArt: string;
  label: string;
  active: boolean;
  rawMaterialCostUsd: number | null;
  rawMaterialEstimated: boolean;
}

interface ArticleOption {
  coArt: string;
  artDes: string;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'attention';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
  { value: 'attention', label: 'Requieren atención' },
];

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// A recipe "needs attention" when its raw-material cost is missing or estimated —
// the same signals the cost panel flags, surfaced here so they aren't buried.
function needsAttention(r: RecipeRow): boolean {
  return r.rawMaterialCostUsd === null || r.rawMaterialEstimated;
}

export function RecetasClient() {
  const router = useRouter();
  const [recipeList, setRecipeList] = useState<RecipeRow[]>([]);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [newCoArt, setNewCoArt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      try {
        const [recipesRes, itemsRes] = await Promise.all([
          fetch('/api/recetas/recipes'),
          // tipo=V: only sellable finished products can have a recipe — raw
          // materials (tipo M) and other article types are never produced.
          fetch('/api/inventory/items?tipo=V'),
        ]);
        if (cancelled) return;
        if (!recipesRes.ok || !itemsRes.ok) {
          setLoadError('No se pudo cargar la información');
          return;
        }
        setRecipeList(await recipesRes.json());
        const items: { coArt: string; artDes: string }[] = await itemsRes.json();
        // /api/inventory/items returns one row per (co_art, co_alma) pair —
        // dedupe by co_art since this picker only needs article identity.
        const seen = new Set<string>();
        const deduped: ArticleOption[] = [];
        for (const i of items) {
          if (seen.has(i.coArt)) continue;
          seen.add(i.coArt);
          deduped.push({ coArt: i.coArt, artDes: i.artDes });
        }
        setArticles(deduped);
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

  const counts = useMemo(() => ({
    all: recipeList.length,
    active: recipeList.filter(r => r.active).length,
    inactive: recipeList.filter(r => !r.active).length,
    attention: recipeList.filter(needsAttention).length,
  }), [recipeList]);

  const filteredRecipes = useMemo(() => {
    const q = normalize(search.trim());
    return recipeList.filter(r => {
      if (filter === 'active' && !r.active) return false;
      if (filter === 'inactive' && r.active) return false;
      if (filter === 'attention' && !needsAttention(r)) return false;
      return q === '' || normalize(r.coArt).includes(q) || normalize(r.label).includes(q);
    });
  }, [recipeList, search, filter]);

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
      // Go straight to the editor — the next step after creating is always adding ingredients.
      if (typeof data.id === 'number') {
        router.push(`/recetas/${data.id}`);
        return;
      }
      setNewCoArt('');
      const listRes = await fetch('/api/recetas/recipes');
      if (listRes.ok) setRecipeList(await listRes.json());
    } catch {
      setCreateError('No se pudo conectar con el servidor');
    } finally {
      setCreating(false);
    }
  }

  const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando recetas…</span>
        <div className="h-8 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-28 rounded-lg bg-gray-100 animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Define la receta de un producto terminado para ver su costo de fabricación,
          calculado en vivo con el método PEPS sobre las capas de costo de Profit Plus.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      <section aria-labelledby="new-recipe-heading" className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
        <h2 id="new-recipe-heading" className="text-sm font-semibold text-gray-900">Nueva receta</h2>
        <label htmlFor="new-recipe-article" className="block text-sm text-gray-600 mt-1 mb-2">
          Crear receta para un producto
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="w-full sm:max-w-md">
            <SearchableSelect
              id="new-recipe-article"
              value={newCoArt}
              onChange={coArt => { setNewCoArt(coArt); setCreateError(null); }}
              options={availableArticles.map(a => ({ value: a.coArt, label: `${a.coArt} — ${a.artDes}` }))}
              placeholder="Busca un producto por código o nombre…"
              className={inputClass}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newCoArt}
            className="px-4 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md
                       disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            {creating ? 'Creando…' : 'Crear Receta'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Solo aparecen productos terminados que aún no tienen receta.
        </p>
        {createError && <p role="alert" className="mt-2 text-sm text-red-700">{createError}</p>}
      </section>

      <section aria-labelledby="recipes-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h2 id="recipes-heading" className="text-sm font-semibold text-gray-900">
            Recetas registradas <span className="font-normal text-gray-500">({counts.all})</span>
          </h2>
          <div className="w-full sm:max-w-xs">
            <label htmlFor="recetas-search" className="sr-only">Buscar receta</label>
            <input
              id="recetas-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre…"
              className={inputClass}
            />
          </div>
        </div>

        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                          ${filter === f.value
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {f.label} <span className={filter === f.value ? 'text-blue-100' : 'text-gray-500'}>{counts[f.value]}</span>
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Producto</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Estado</th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Costo materia prima (USD)</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecipes.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/recetas/${r.id}`}
                      className="font-medium text-gray-900 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    >
                      {r.label}
                    </Link>
                    <div className="font-mono text-xs text-gray-500">{r.coArt}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge active={r.active} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <CostBadge costUsd={r.rawMaterialCostUsd} estimated={r.rawMaterialEstimated} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/recetas/${r.id}`}
                      aria-label={`Editar receta y ver costo de ${r.label}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700
                                 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      Editar / Costo
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecipes.length === 0 && (
            <div className="text-center py-10 px-4 text-sm text-gray-500">
              {recipeList.length === 0 ? (
                <>
                  <p className="font-medium text-gray-700">Aún no hay recetas.</p>
                  <p className="mt-1">Elige un producto arriba y pulsa “Crear Receta” para empezar.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-700">Ninguna receta coincide con tu búsqueda.</p>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setFilter('all'); }}
                    className="mt-2 text-blue-700 hover:underline"
                  >
                    Limpiar búsqueda y filtros
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
