'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import type { Currency, DateRange } from './types';
import TabResumen from './tabs/tab-resumen';
import TabVentas from './tabs/tab-ventas';
import TabDevoluciones from './tabs/tab-devoluciones';
import TabCxc from './tabs/tab-cxc';
import TabVendedores from './tabs/tab-vendedores';
import TabClientes from './tabs/tab-clientes';
import TabProductos from './tabs/tab-productos';
import TabFinanzas from './tabs/tab-finanzas';
import TabMultimoneda from './tabs/tab-multimoneda';
import TabCompras from './tabs/tab-compras';
import TabStub from './tabs/tab-stub';

export interface TabComponentProps {
  dateRange: DateRange;
  currency: Currency;
}

interface TabDef {
  key: string;
  label: string;
  component: ComponentType<TabComponentProps>;
}

const TABS: TabDef[] = [
  { key: 'resumen', label: 'Resumen', component: TabResumen },
  { key: 'ventas', label: 'Ventas', component: TabVentas },
  { key: 'devoluciones', label: 'Devoluciones', component: TabDevoluciones },
  { key: 'cxc', label: 'CXC y Cobranzas', component: TabCxc },
  { key: 'vendedores', label: 'Vendedores', component: TabVendedores },
  { key: 'clientes', label: 'Clientes', component: TabClientes },
  { key: 'productos', label: 'Productos', component: TabProductos },
  { key: 'finanzas', label: 'Finanzas', component: TabFinanzas },
  { key: 'multimoneda', label: 'Multimoneda', component: TabMultimoneda },
  { key: 'compras', label: 'Compras', component: TabCompras },
  { key: 'rutas', label: 'Rutas y Logística', component: () => <TabStub title="Rutas y Logística" /> },
];

const DEFAULT_TAB = 'resumen';
const DEFAULT_DATE_RANGE: DateRange = '12m';
const DEFAULT_CURRENCY: Currency = 'bs';
const CURRENCY_STORAGE_KEY = 'analytics-currency';

const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'month', label: 'Mes Actual' },
  { value: 'month-prev', label: 'Mes Anterior' },
  { value: 'ytd', label: 'Año Actual' },
  { value: '12m', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
];

const CUSTOM_RANGE_RE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
const MONTH_RANGE_RE = /^month:(\d{4})-(\d{2})$/;
const YTD_RANGE_RE = /^ytd:(\d{4})$/;

function isValidDateRange(value: string | null): value is DateRange {
  if (value === '12m') return true;
  if (value === null) return false;
  return CUSTOM_RANGE_RE.test(value) || MONTH_RANGE_RE.test(value) || YTD_RANGE_RE.test(value);
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYtdKey(): string {
  return String(new Date().getFullYear());
}

// Adds or subtracts whole months from a "YYYY-MM" key, wrapping year
// boundaries correctly (e.g. 2026-01 minus 1 month = 2025-12).
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidCurrency(value: string | null): value is Currency {
  return value === 'bs' || value === 'usd';
}

export function AnaliticaClient() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Cargando panel analítico…</div>}>
      <AnaliticaClientInner />
    </Suspense>
  );
}

function AnaliticaClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam ?? DEFAULT_TAB;

  const dateRangeParam = searchParams.get('dateRange');
  const dateRange: DateRange = isValidDateRange(dateRangeParam) ? dateRangeParam : DEFAULT_DATE_RANGE;
  const isCustomRange = CUSTOM_RANGE_RE.test(dateRange);
  const customMatch = CUSTOM_RANGE_RE.exec(dateRange);
  const [customStart, setCustomStart] = useState(customMatch?.[1] ?? todayIso());
  const [customEnd, setCustomEnd] = useState(customMatch?.[2] ?? todayIso());
  // Selecting "Personalizado" before picking both dates has no `custom:` param
  // yet — track that intent separately so the date inputs render immediately
  // instead of silently falling back to another button looking "active".
  const [customPending, setCustomPending] = useState(false);
  const isMonthRange = MONTH_RANGE_RE.test(dateRange);
  const monthMatch = MONTH_RANGE_RE.exec(dateRange);
  const isYtdRange = YTD_RANGE_RE.test(dateRange);

  const currencyParam = searchParams.get('currency');
  // Fallback currency for when the URL has no `currency` param: seeded from
  // localStorage on first render, updated whenever the user toggles currency.
  const [storedCurrency, setStoredCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (isValidCurrency(stored)) return stored;
    }
    return DEFAULT_CURRENCY;
  });
  // URL takes precedence over localStorage; derived directly during render
  // so it always reflects the current param (no effect needed).
  const currency: Currency = isValidCurrency(currencyParam) ? currencyParam : storedCurrency;

  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([activeTab]));

  // Track newly-activated tabs during render (React's documented pattern for
  // adjusting state from props, guarded to avoid render loops) rather than in
  // an effect, since this is a pure derivation of `activeTab`.
  if (!mountedTabs.has(activeTab)) {
    setMountedTabs(prev => {
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }

  useEffect(() => {
    posthog.capture('analytics_tab_viewed', { tab: activeTab });
  }, [activeTab]);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleTabChange = useCallback(
    (key: string) => {
      updateParams({ tab: key });
    },
    [updateParams]
  );

  // No useCallback here: the React Compiler could not preserve this
  // function's manual memoization (its dependency array didn't match what
  // the compiler infers), so the compiler already memoizes it as
  // effectively as a correct manual wrapper would — see React's own
  // preserve-manual-memoization guidance.
  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setCustomPending(true);
      updateParams({ dateRange: `custom:${customStart}:${customEnd}` });
      return;
    }
    setCustomPending(false);
    if (value === 'month') {
      updateParams({ dateRange: `month:${currentMonthKey()}` });
      return;
    }
    if (value === 'month-prev') {
      updateParams({ dateRange: `month:${shiftMonthKey(currentMonthKey(), -1)}` });
      return;
    }
    if (value === 'ytd') {
      updateParams({ dateRange: `ytd:${currentYtdKey()}` });
      return;
    }
    updateParams({ dateRange: value });
  };

  const handleMonthPage = useCallback(
    (delta: number) => {
      if (!monthMatch) return;
      const currentKey = `${monthMatch[1]}-${monthMatch[2]}`;
      updateParams({ dateRange: `month:${shiftMonthKey(currentKey, delta)}` });
    },
    [updateParams, monthMatch]
  );

  // No useCallback here — same React Compiler preserve-manual-memoization
  // reasoning as handleDateRangeChange above.
  const handleCustomDateChange = (which: 'start' | 'end', value: string) => {
    const nextStart = which === 'start' ? value : customStart;
    const nextEnd = which === 'end' ? value : customEnd;
    if (which === 'start') setCustomStart(value);
    else setCustomEnd(value);
    if (nextStart && nextEnd) {
      updateParams({ dateRange: `custom:${nextStart}:${nextEnd}` });
    }
  };

  const handleCurrencyChange = useCallback(
    (value: Currency) => {
      setStoredCurrency(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, value);
      }
      updateParams({ currency: value });
    },
    [updateParams, setStoredCurrency]
  );

  const activeTabDef = useMemo(() => TABS.find(t => t.key === activeTab), [activeTab]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Global header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analítica</h1>
            <p className="text-sm text-gray-500">
              Ventas, devoluciones, cobranza y cartera — datos del Data Warehouse
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date range filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
                {DATE_RANGE_OPTIONS.map(opt => {
                  const isActive = opt.value === 'custom'
                    ? (isCustomRange || customPending)
                    : opt.value === 'month'
                      ? isMonthRange && `${monthMatch?.[1]}-${monthMatch?.[2]}` === currentMonthKey()
                      : opt.value === 'month-prev'
                        ? isMonthRange && `${monthMatch?.[1]}-${monthMatch?.[2]}` === shiftMonthKey(currentMonthKey(), -1)
                        : opt.value === 'ytd'
                          ? isYtdRange
                          : dateRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleDateRangeChange(opt.value)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isMonthRange && monthMatch && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <button
                    onClick={() => handleMonthPage(-1)}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Mes anterior"
                  >
                    ◀
                  </button>
                  <span className="min-w-[10rem] text-center">{formatMonthLabel(`${monthMatch[1]}-${monthMatch[2]}`)}</span>
                  <button
                    onClick={() => handleMonthPage(1)}
                    className="px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Mes siguiente"
                  >
                    ▶
                  </button>
                </div>
              )}
              {(isCustomRange || customPending) && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={e => handleCustomDateChange('start', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm"
                    aria-label="Fecha inicial"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={todayIso()}
                    onChange={e => handleCustomDateChange('end', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm"
                    aria-label="Fecha final"
                  />
                </div>
              )}
            </div>
            {/* Currency toggle */}
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => handleCurrencyChange('bs')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  currency === 'bs' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Bs.
              </button>
              <button
                onClick={() => handleCurrencyChange('usd')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  currency === 'usd' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                USD
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation bar */}
      <div className="border-b border-gray-200 bg-white px-6 overflow-x-auto">
        <nav className="flex gap-6" aria-label="Tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
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

      {/* Tab content area */}
      <div className="flex-1 overflow-auto">
        {!activeTabDef && (
          <div className="p-6">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
              Tab not found: {activeTab}
            </p>
          </div>
        )}
        {TABS.filter(tab => mountedTabs.has(tab.key)).map(tab => {
          const TabComponent = tab.component;
          return (
            <div key={tab.key} className={tab.key === activeTab ? 'h-full' : 'hidden'}>
              <TabComponent dateRange={dateRange} currency={currency} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
