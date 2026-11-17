'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import type { Currency, HistTabProps, ReturnsBasis } from './types';
import { allowedGranularities, resolveGranularity, type Granularity } from '../analitica/lib/granularity';
import { resolveReturnsBasis } from '../analitica/lib/returns-basis';
import ReturnsBasisSelector from '../analitica/components/returns-basis-selector';
import {
  HIST_END_KEY, HIST_START_KEY, histPresetRange, isoToKey, keyToIso, resolveHistRange, type HistPreset,
} from '@/lib/analitica-historica/window';
import {
  HIST_GRANULARITY_TABS, HIST_RETURNS_BASIS_TABS, HIST_TAB_KEYS, HIST_TAB_LABELS, resolveHistTab, type HistTabKey,
} from './lib/tab-keys';
import { HistBanner } from './components/hist-banner';
import TabResumen from './tabs/tab-resumen';
import TabVentas from './tabs/tab-ventas';
import TabDevoluciones from './tabs/tab-devoluciones';
import TabClientes from './tabs/tab-clientes';
import TabProductos from './tabs/tab-productos';
import TabVendedores from './tabs/tab-vendedores';

const TAB_COMPONENTS: Record<HistTabKey, ComponentType<HistTabProps>> = {
  resumen: TabResumen,
  ventas: TabVentas,
  devoluciones: TabDevoluciones,
  clientes: TabClientes,
  productos: TabProductos,
  vendedores: TabVendedores,
};

const CURRENCY_STORAGE_KEY = 'analytics-currency';
const GRANULARITY_LABELS: Record<Granularity, string> = { day: 'Día', week: 'Semana', month: 'Mes' };
const DEFAULT_DATE_RANGE = histPresetRange('12m');

// Same buttons as the main Analítica, but every preset is anchored to the END OF
// THE LEGACY DATA (not today) and resolves to a concrete custom:/month: value.
const PRESETS: { value: HistPreset; label: string }[] = [
  { value: '30d', label: '30 días' },
  { value: 'month', label: 'Último mes' },
  { value: 'month-prev', label: 'Mes anterior' },
  { value: 'year', label: 'Último año' },
  { value: '12m', label: '12 meses' },
  { value: 'all', label: 'Todo' },
];

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;

const WINDOW_START_ISO = keyToIso(HIST_START_KEY);
const WINDOW_END_ISO = keyToIso(HIST_END_KEY);

function isValidDateRange(value: string | null): value is string {
  if (value === null) return false;
  const custom = CUSTOM_RANGE_RE.exec(value);
  if (custom) return !Number.isNaN(isoToKey(custom[1])) && !Number.isNaN(isoToKey(custom[2]));
  return MONTH_RANGE_RE.test(value);
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const d = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const d = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, 1));
  const formatted = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function isValidCurrency(value: string | null): value is Currency {
  return value === 'bs' || value === 'usd';
}

export function AnaliticaHistoricaClient() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Cargando analítica histórica…</div>}>
      <AnaliticaHistoricaClientInner />
    </Suspense>
  );
}

function AnaliticaHistoricaClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab: HistTabKey = resolveHistTab(searchParams.get('tab'));

  const dateRangeParam = searchParams.get('dateRange');
  const dateRange: string = isValidDateRange(dateRangeParam) ? dateRangeParam : DEFAULT_DATE_RANGE;
  const resolved = resolveHistRange(dateRange);
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  const isCustomRange = customMatch !== null;
  const [customStart, setCustomStart] = useState(customMatch?.[1] ?? keyToIso(resolved.startKey));
  const [customEnd, setCustomEnd] = useState(customMatch?.[2] ?? keyToIso(resolved.endKey));

  const granularity: Granularity = resolveGranularity(dateRange, searchParams.get('granularity'));
  const allowedGranularity = allowedGranularities(dateRange);
  const returnsBasis: ReturnsBasis = resolveReturnsBasis(searchParams.get('returnsBasis'));

  const currencyParam = searchParams.get('currency');
  const [storedCurrency, setStoredCurrency] = useState<Currency>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(CURRENCY_STORAGE_KEY) : null;
      if (isValidCurrency(stored)) return stored;
    } catch { /* storage unavailable */ }
    return 'bs';
  });
  const currency: Currency = isValidCurrency(currencyParam) ? currencyParam : storedCurrency;

  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([activeTab]));
  if (!mountedTabs.has(activeTab)) {
    setMountedTabs(prev => new Set(prev).add(activeTab));
  }

  useEffect(() => {
    posthog.capture('analytics_historica_tab_viewed', { tab: activeTab });
  }, [activeTab]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) params.set(key, value);
      // A new range invalidates the previous granularity choice.
      if ('dateRange' in updates && !('granularity' in updates)) params.delete('granularity');
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handlePreset = (preset: HistPreset) => updateParams({ dateRange: histPresetRange(preset) });

  const handleCustom = () => updateParams({ dateRange: `custom:${customStart}:${customEnd}` });

  const handleCustomDateChange = (which: 'start' | 'end', value: string) => {
    const nextStart = which === 'start' ? value : customStart;
    const nextEnd = which === 'end' ? value : customEnd;
    if (which === 'start') setCustomStart(value);
    else setCustomEnd(value);
    if (nextStart && nextEnd) updateParams({ dateRange: `custom:${nextStart}:${nextEnd}` });
  };

  const monthKey = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : null;
  const handleMonthPage = (delta: number) => {
    if (monthKey) updateParams({ dateRange: `month:${shiftMonthKey(monthKey, delta)}` });
  };
  const canPageBack = monthKey !== null && shiftMonthKey(monthKey, -1) >= WINDOW_START_ISO.slice(0, 7);
  const canPageForward = monthKey !== null && shiftMonthKey(monthKey, 1) <= WINDOW_END_ISO.slice(0, 7);

  const handleCurrencyChange = (value: Currency) => {
    setStoredCurrency(value);
    try { window.localStorage.setItem(CURRENCY_STORAGE_KEY, value); } catch { /* storage unavailable */ }
    updateParams({ currency: value });
  };

  const tabs = useMemo(() => HIST_TAB_KEYS.map(key => ({ key, label: HIST_TAB_LABELS[key], component: TAB_COMPONENTS[key] })), []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 print:h-auto print:overflow-visible">
      <div className="border-b border-gray-200 bg-white px-6 py-4 print:hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analítica histórica</h1>
            <p className="text-sm text-gray-500">
              Ventas y devoluciones del sistema anterior — enero 2020 a febrero 2026
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
                {PRESETS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handlePreset(opt.value)}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      dateRange === histPresetRange(opt.value) ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={handleCustom}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    isCustomRange && !PRESETS.some(p => histPresetRange(p.value) === dateRange)
                      ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Personalizado
                </button>
              </div>
              {monthKey && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <button onClick={() => handleMonthPage(-1)} disabled={!canPageBack} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Mes anterior">◀</button>
                  <span className="min-w-[10rem] text-center">{formatMonthLabel(monthKey)}</span>
                  <button onClick={() => handleMonthPage(1)} disabled={!canPageForward} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Mes siguiente">▶</button>
                </div>
              )}
              {isCustomRange && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="date" value={customStart} min={WINDOW_START_ISO} max={customEnd}
                    onChange={e => handleCustomDateChange('start', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm" aria-label="Fecha inicial"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="date" value={customEnd} min={customStart} max={WINDOW_END_ISO}
                    onChange={e => handleCustomDateChange('end', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm" aria-label="Fecha final"
                  />
                </div>
              )}
            </div>
            {HIST_GRANULARITY_TABS.has(activeTab) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Tendencia</span>
                <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label="Granularidad de tendencias">
                  {allowedGranularity.map(g => (
                    <button
                      key={g}
                      onClick={() => updateParams({ granularity: g })}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        granularity === g ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {GRANULARITY_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {HIST_RETURNS_BASIS_TABS.has(activeTab) && (
              <ReturnsBasisSelector value={returnsBasis} onChange={b => updateParams({ returnsBasis: b })} />
            )}
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              {(['bs', 'usd'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => handleCurrencyChange(c)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    currency === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {c === 'bs' ? 'Bs.' : 'USD'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 overflow-x-auto print:hidden">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => updateParams({ tab: tab.key })}
              className={`whitespace-nowrap px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto print:overflow-visible print:h-auto">
        <div className="px-6 pt-4"><HistBanner /></div>
        {tabs.filter(tab => mountedTabs.has(tab.key)).map(tab => {
          const TabComponent = tab.component;
          return (
            <div key={tab.key} className={tab.key === activeTab ? 'h-full print:h-auto' : 'hidden'}>
              <TabComponent dateRange={dateRange} currency={currency} granularity={granularity} returnsBasis={returnsBasis} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
