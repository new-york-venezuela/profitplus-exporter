'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  { key: 'compras', label: 'Compras', component: () => <TabStub title="Compras" /> },
  { key: 'rutas', label: 'Rutas y Logística', component: () => <TabStub title="Rutas y Logística" /> },
];

const DEFAULT_TAB = 'resumen';
const DEFAULT_DATE_RANGE: DateRange = '12m';
const DEFAULT_CURRENCY: Currency = 'bs';
const CURRENCY_STORAGE_KEY = 'analytics-currency';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '12m', label: '12 meses' },
];

function isValidDateRange(value: string | null): value is DateRange {
  return value === '30d' || value === '90d' || value === '12m' || value === 'custom';
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

  const handleDateRangeChange = useCallback(
    (value: DateRange) => {
      updateParams({ dateRange: value });
    },
    [updateParams]
  );

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
            <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
              {DATE_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleDateRangeChange(opt.value)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    dateRange === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
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
