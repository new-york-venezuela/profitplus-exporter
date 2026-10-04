'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchableSelect } from '@/components/searchable-select';
import { Modal } from '@/components/modal';
import { CostBadge, EstimatedBadge, NoDataBadge, StatusBadge, formatUsd } from '../recipe-ui';

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

interface UnitOption {
  coUni: string;
  desUni: string;
  uniPrincipal: boolean;
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
  rawMaterialCostUsd: number | null;
  rawMaterialEstimated: boolean;
}

function emptyErpLine(): Line {
  return { lineType: 'erp_article', coArt: '', manualLabel: null, quantity: 0, unit: 'KG', manualUnitCostUsd: null };
}

function emptyManualLine(): Line {
  return { lineType: 'manual', coArt: null, manualLabel: '', quantity: 0, unit: 'LTS', manualUnitCostUsd: 0 };
}

interface LineErrors {
  item?: string;
  quantity?: string;
  unit?: string;
  cost?: string;
}

// Mirrors the server-side isValidLine rules so users see what is wrong, and where,
// before the request is rejected with a generic "Renglón de receta inválido".
function validateLine(line: Line): LineErrors {
  const errors: LineErrors = {};
  if (line.lineType === 'erp_article' && !(line.coArt ?? '').trim()) errors.item = 'Selecciona un artículo';
  if (line.lineType === 'manual' && !(line.manualLabel ?? '').trim()) errors.item = 'Escribe el nombre del insumo';
  if (!(line.quantity > 0)) errors.quantity = 'Debe ser mayor que 0';
  if (!line.unit.trim()) errors.unit = 'Requerida';
  if (line.lineType === 'manual' && (line.manualUnitCostUsd ?? 0) < 0) errors.cost = 'No puede ser negativo';
  return errors;
}

const inputClass = `w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
const invalidClass = 'border-red-400 focus:ring-red-500 focus:border-red-500';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs text-red-700">{message}</p>;
}

export function RecipeDetailClient({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [label, setLabel] = useState('');
  const [active, setActive] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  // Last persisted state: drives the dirty indicator, and labels the cost panel
  // (the cost endpoint prices what is saved, not what is being edited).
  const [saved, setSaved] = useState<{ label: string; active: boolean; lines: Line[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [unitsByArticle, setUnitsByArticle] = useState<Record<string, UnitOption[]>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const pendingFocusRef = useRef<number | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  // Mirrors unitsByArticle without being a hook dependency, so ensureUnitsLoaded
  // stays referentially stable — it's called from the recipe-load effect, and
  // depending on unitsByArticle there would re-trigger that effect (re-fetching
  // the whole recipe) every time a units fetch resolves.
  const unitsCacheRef = useRef<Record<string, UnitOption[]>>({});
  const fetchingUnits = useRef(new Set<string>());

  const ensureUnitsLoaded = useCallback(async (coArt: string) => {
    if (!coArt || unitsCacheRef.current[coArt] || fetchingUnits.current.has(coArt)) return;
    fetchingUnits.current.add(coArt);
    try {
      const res = await fetch(`/api/inventory/items/${encodeURIComponent(coArt)}/units`);
      if (res.ok) {
        const units: UnitOption[] = await res.json();
        unitsCacheRef.current = { ...unitsCacheRef.current, [coArt]: units };
        setUnitsByArticle(unitsCacheRef.current);
      }
    } finally {
      fetchingUnits.current.delete(coArt);
    }
  }, []);

  const loadCost = useCallback(async () => {
    setCostLoading(true);
    setCostError(null);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}/cost`);
      if (res.ok) setCost(await res.json());
      else setCostError('No se pudo calcular el costo');
    } catch {
      setCostError('No se pudo calcular el costo');
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
        setLabel(recipeData.label);
        setActive(recipeData.active);
        setLines(recipeData.lines);
        setSaved({ label: recipeData.label, active: recipeData.active, lines: recipeData.lines });
        if (itemsRes.ok) {
          const items: { coArt: string; artDes: string; unidad: string | null }[] = await itemsRes.json();
          // /api/inventory/items returns one row per (co_art, co_alma) pair —
          // dedupe by co_art since this picker only needs article identity.
          const seen = new Set<string>();
          const deduped: ArticleOption[] = [];
          for (const i of items) {
            if (seen.has(i.coArt)) continue;
            seen.add(i.coArt);
            deduped.push(i);
          }
          setArticles(deduped);
        }
        for (const line of recipeData.lines) {
          if (line.lineType === 'erp_article' && line.coArt) void ensureUnitsLoaded(line.coArt);
        }
        if (!cancelled) await loadCost();
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [recipeId, loadCost, ensureUnitsLoaded]);

  const articleName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of articles) map.set(a.coArt, a.artDes);
    return map;
  }, [articles]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    return label !== saved.label || active !== saved.active || JSON.stringify(lines) !== JSON.stringify(saved.lines);
  }, [saved, label, active, lines]);

  const lineErrors = useMemo(() => lines.map(validateLine), [lines]);
  const labelError = label.trim() ? undefined : 'El nombre no puede estar vacío';
  const errorCount = lineErrors.filter(e => Object.keys(e).length > 0).length + (labelError ? 1 : 0);

  // Warn before losing unsaved edits (tab close / reload).
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  // Move keyboard focus to the first field of a freshly added line.
  useEffect(() => {
    if (pendingFocusRef.current === null) return;
    document.getElementById(`line-${pendingFocusRef.current}-item`)?.focus();
    pendingFocusRef.current = null;
  }, [lines.length]);

  function touch() {
    setJustSaved(false);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    touch();
    setLines(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  }

  function addLine(line: Line) {
    touch();
    setLines(prev => [...prev, line]);
    pendingFocusRef.current = lines.length;
  }

  async function handleArticleSelect(index: number, coArt: string) {
    updateLine(index, { coArt });
    if (!coArt) return;
    await ensureUnitsLoaded(coArt);
    const units = unitsCacheRef.current[coArt];
    const principal = units?.find(u => u.uniPrincipal) ?? units?.[0];
    if (principal) updateLine(index, { coArt, unit: principal.coUni });
  }

  function removeLine(index: number) {
    touch();
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!recipe) return;
    if (errorCount > 0) {
      setShowErrors(true);
      setSaveError(null);
      // Let the summary render, then move focus to it so keyboard/screen-reader users land on the problem.
      setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), active, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? 'No se pudo guardar la receta');
        return;
      }
      setShowErrors(false);
      setSaved({ label: label.trim(), active, lines });
      setLabel(label.trim());
      setJustSaved(true);
      await loadCost();
    } catch {
      setSaveError('No se pudo conectar con el servidor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/recetas/recipes/${recipeId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/recetas');
        return;
      }
      setDeleteError('No se pudo eliminar la receta');
    } catch {
      setDeleteError('No se pudo conectar con el servidor');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando receta…</span>
        <div className="h-8 w-72 rounded bg-gray-200 animate-pulse" />
        <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
          <div className="h-72 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-56 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }
  if (loadError || !recipe) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        <p role="alert" className="text-sm text-red-700">{loadError ?? 'Receta no encontrada'}</p>
        <Link href="/recetas" className="text-sm text-blue-700 hover:underline">← Volver a recetas</Link>
      </div>
    );
  }

  // Cost lines correspond to the saved lines, in order.
  const costLabel = (l: CostLineResult, i: number): string => {
    if (l.coArt) return articleName.get(l.coArt) ?? l.coArt;
    return saved?.lines[i]?.manualLabel ?? '—';
  };
  const costUnit = (i: number): string => saved?.lines[i]?.unit ?? '';

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-5">
      <nav aria-label="Ruta de navegación">
        <Link href="/recetas" className="text-sm text-blue-700 hover:underline">← Recetas</Link>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 break-words">{recipe.coArt} — {saved?.label ?? recipe.label}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <StatusBadge active={saved?.active ?? recipe.active} />
            {dirty && <span className="text-amber-800">Cambios sin guardar</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}
          className="self-start px-3 py-2 min-h-[40px] rounded-md border border-red-300 text-sm font-medium text-red-700
                     hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Eliminar receta
        </button>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start">
        {/* ── Editor ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <section aria-labelledby="general-heading" className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-4">
            <h2 id="general-heading" className="text-sm font-semibold text-gray-900">Datos generales</h2>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1">
                <label htmlFor="recipe-label" className="block text-sm text-gray-700 mb-1">Nombre de la receta</label>
                <input
                  id="recipe-label"
                  type="text"
                  value={label}
                  onChange={e => { touch(); setLabel(e.target.value); }}
                  aria-invalid={showErrors && !!labelError}
                  aria-describedby={showErrors && labelError ? 'recipe-label-error' : undefined}
                  className={`${inputClass} ${showErrors && labelError ? invalidClass : ''}`}
                />
                <FieldError id="recipe-label-error" message={showErrors ? labelError : undefined} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[40px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => { touch(); setActive(e.target.checked); }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Receta activa
              </label>
            </div>
          </section>

          <section aria-labelledby="lines-heading" className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="lines-heading" className="text-sm font-semibold text-gray-900">
                Insumos <span className="font-normal text-gray-500">({lines.length})</span>
              </h2>
            </div>

            {lines.length === 0 && (
              <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-600">
                <p className="font-medium text-gray-800">Esta receta aún no tiene insumos.</p>
                <p className="mt-1">Agrega un insumo de Profit Plus (costo en vivo) o uno manual (por ejemplo, agua).</p>
              </div>
            )}

            <ul className="space-y-3">
              {lines.map((line, index) => {
                const errs = showErrors ? lineErrors[index]! : {};
                const isErp = line.lineType === 'erp_article';
                const units = isErp && line.coArt ? unitsByArticle[line.coArt] : undefined;
                const itemLabel = isErp
                  ? (line.coArt ? (articleName.get(line.coArt) ?? line.coArt) : 'sin artículo')
                  : (line.manualLabel || 'sin nombre');
                return (
                  <li key={index} className="rounded-md border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isErp ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                        }`}
                      >
                        {isErp ? 'Profit Plus · costo PEPS' : 'Manual · costo fijo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        aria-label={`Quitar insumo ${itemLabel}`}
                        className="px-2 py-1 min-h-[36px] rounded text-sm text-red-700 hover:bg-red-50
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                      <div className="col-span-2 sm:col-span-6">
                        {isErp ? (
                          <>
                            <label htmlFor={`line-${index}-item`} className="block text-xs font-medium text-gray-700 mb-1">Artículo</label>
                            <SearchableSelect
                              id={`line-${index}-item`}
                              value={line.coArt ?? ''}
                              onChange={coArt => void handleArticleSelect(index, coArt)}
                              options={articles.map(a => ({ value: a.coArt, label: `${a.coArt} — ${a.artDes}` }))}
                              placeholder="Busca por código o nombre…"
                              className={`${inputClass} ${errs.item ? invalidClass : ''}`}
                            />
                          </>
                        ) : (
                          <>
                            <label htmlFor={`line-${index}-item`} className="block text-xs font-medium text-gray-700 mb-1">Insumo (manual)</label>
                            <input
                              id={`line-${index}-item`}
                              type="text"
                              value={line.manualLabel ?? ''}
                              onChange={e => updateLine(index, { manualLabel: e.target.value })}
                              placeholder="Ej: Agua"
                              aria-invalid={!!errs.item}
                              aria-describedby={errs.item ? `line-${index}-item-error` : undefined}
                              className={`${inputClass} ${errs.item ? invalidClass : ''}`}
                            />
                          </>
                        )}
                        <FieldError id={`line-${index}-item-error`} message={errs.item} />
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor={`line-${index}-qty`} className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                        <input
                          id={`line-${index}-qty`}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={line.quantity === 0 ? '' : line.quantity}
                          onChange={e => updateLine(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                          aria-invalid={!!errs.quantity}
                          aria-describedby={errs.quantity ? `line-${index}-qty-error` : undefined}
                          className={`${inputClass} tabular-nums ${errs.quantity ? invalidClass : ''}`}
                        />
                        <FieldError id={`line-${index}-qty-error`} message={errs.quantity} />
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor={`line-${index}-unit`} className="block text-xs font-medium text-gray-700 mb-1">Unidad</label>
                        {units?.length ? (
                          <select
                            id={`line-${index}-unit`}
                            value={line.unit}
                            onChange={e => updateLine(index, { unit: e.target.value })}
                            className={inputClass}
                          >
                            {units.map(u => (
                              <option key={u.coUni} value={u.coUni}>{u.desUni}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`line-${index}-unit`}
                            type="text"
                            value={line.unit}
                            onChange={e => updateLine(index, { unit: e.target.value })}
                            aria-invalid={!!errs.unit}
                            aria-describedby={errs.unit ? `line-${index}-unit-error` : undefined}
                            className={`${inputClass} ${errs.unit ? invalidClass : ''}`}
                          />
                        )}
                        <FieldError id={`line-${index}-unit-error`} message={errs.unit} />
                      </div>

                      {!isErp && (
                        <div className="col-span-2">
                          <label htmlFor={`line-${index}-cost`} className="block text-xs font-medium text-gray-700 mb-1">Costo USD / unidad</label>
                          <input
                            id={`line-${index}-cost`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={line.manualUnitCostUsd ?? 0}
                            onChange={e => updateLine(index, { manualUnitCostUsd: e.target.value === '' ? 0 : Number(e.target.value) })}
                            aria-invalid={!!errs.cost}
                            aria-describedby={errs.cost ? `line-${index}-cost-error` : undefined}
                            className={`${inputClass} tabular-nums ${errs.cost ? invalidClass : ''}`}
                          />
                          <FieldError id={`line-${index}-cost-error`} message={errs.cost} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addLine(emptyErpLine())}
                className="px-3 py-2 min-h-[40px] rounded-md border border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                + Insumo de Profit Plus
              </button>
              <button
                type="button"
                onClick={() => addLine(emptyManualLine())}
                className="px-3 py-2 min-h-[40px] rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                + Insumo manual
              </button>
            </div>
          </section>

          {/* Save bar: sticks to the bottom so it is always reachable on long recipes. */}
          <div className="sticky bottom-0 -mx-4 sm:mx-0 bg-white/95 backdrop-blur border-t sm:border sm:rounded-lg border-gray-200 px-4 py-3 space-y-2">
            {showErrors && errorCount > 0 && (
              <div
                ref={errorSummaryRef}
                tabIndex={-1}
                role="alert"
                className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Corrige {errorCount === 1 ? '1 campo' : `${errorCount} renglones`} antes de guardar.
              </div>
            )}
            {saveError && (
              <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">{saveError}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!dirty && !showErrors)}
                className="px-4 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md
                           disabled:opacity-40 disabled:cursor-not-allowed
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                {saving ? 'Guardando…' : 'Guardar Receta'}
              </button>
              <p role="status" aria-live="polite" className="text-sm">
                {justSaved && !dirty && <span className="text-green-700">✓ Cambios guardados</span>}
                {dirty && !saving && <span className="text-amber-800">Tienes cambios sin guardar</span>}
              </p>
            </div>
          </div>
        </div>

        {/* ── Cost panel ─────────────────────────────────────────── */}
        <aside aria-labelledby="cost-heading" className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="cost-heading" className="text-sm font-semibold text-gray-900">Costo de Fabricación (en vivo)</h2>
            <button
              type="button"
              onClick={() => void loadCost()}
              disabled={costLoading}
              className="px-2 py-1 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Recalcular
            </button>
          </div>

          <div aria-busy={costLoading} className="space-y-3">
            {costLoading && <p role="status" className="text-sm text-gray-600">Calculando…</p>}
            {costError && !costLoading && <p role="alert" className="text-sm text-red-700">{costError}</p>}

            {!costLoading && cost && (
              <>
                {/* Invariant: the incomplete/estimated warning leads the panel, before any number. */}
                {cost.incomplete && (
                  <p role="alert" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <strong className="font-semibold">Costo incompleto.</strong>{' '}
                    Este costo es incompleto o estimado — algún insumo no tiene suficiente historial de compras en Profit Plus.
                  </p>
                )}

                {dirty && (
                  <p className="text-xs text-gray-600">
                    Muestra la última versión guardada. Guarda para recalcular con tus cambios.
                  </p>
                )}

                <div>
                  <p className="text-xs text-gray-600">Costo total por unidad producida</p>
                  <p data-testid="cost-total" className="text-3xl font-bold text-gray-900 tabular-nums">{formatUsd(cost.totalUsd)}</p>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm border-t border-gray-100 pt-3">
                  <span className="text-gray-600">
                    Materia prima
                    <span className="block text-xs text-gray-500">Solo insumos de Profit Plus</span>
                  </span>
                  <CostBadge costUsd={cost.rawMaterialCostUsd} estimated={cost.rawMaterialEstimated} />
                </div>

                {cost.lines.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Desglose por insumo</h3>
                    <ul className="divide-y divide-gray-100">
                      {cost.lines.map((l, i) => (
                        <li key={i} className="py-2 flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="text-gray-900 break-words">{costLabel(l, i)}</p>
                            <p className="text-xs text-gray-500 tabular-nums">{l.quantity} {costUnit(i)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {l.costUsd === null ? (
                              <NoDataBadge />
                            ) : (
                              <span className="tabular-nums text-gray-900">{formatUsd(l.costUsd)}</span>
                            )}
                            {l.estimated && <div className="mt-1"><EstimatedBadge /></div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cost.lines.length === 0 && (
                  <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">
                    Agrega insumos y guarda para ver el desglose.
                  </p>
                )}

                {cost.asOfRateDate && (
                  <p className="text-xs text-gray-500">Tasa USD vigente al {cost.asOfRateDate}</p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {confirmingDelete && (
        <Modal title="Eliminar receta" onClose={() => { if (!deleting) setConfirmingDelete(false); }}>
          <p className="text-sm text-gray-700">
            ¿Eliminar la receta de <strong>{recipe.label}</strong>? Se borrarán también sus {saved?.lines.length ?? 0} insumos. Esta acción no se puede deshacer.
          </p>
          {deleteError && <p role="alert" className="mt-3 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="px-4 py-2 min-h-[40px] rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="px-4 py-2 min-h-[40px] rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
            >
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
