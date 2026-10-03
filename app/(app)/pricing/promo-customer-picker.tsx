'use client';
import { useEffect, useRef, useState } from 'react';
import type { CustomerPage } from '@/lib/pricing/client-types';
import { CUSTOMERS_MAX } from '@/lib/pricing/promo-wizard';
import { apiGet, ApiError } from './api-client';
import { FOCUS } from './dialog-parts';
import { useDebounced } from './use-debounced';

export interface PickedCustomer { coCli: string; cliDes: string }

const PAGE_SIZE = 20;

interface Props {
  picked: PickedCustomer[];
  onChange: (next: PickedCustomer[]) => void;
  errorId?: string;
  invalid?: boolean;
}

export default function PromoCustomerPicker({ picked, onChange, errorId, invalid }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search.trim(), 300);
  const [result, setResult] = useState<{ key: string; data: CustomerPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [tick, setTick] = useState(0);
  const request = useRef(0);

  const key = `${debounced}|${page}|${tick}`;
  useEffect(() => {
    const id = ++request.current;
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debounced) q.set('search', debounced);
    apiGet<CustomerPage>(`/api/pricing/customers?${q.toString()}`)
      .then(data => { if (id === request.current) { setResult({ key, data }); setFailure(null); } })
      .catch(e => { if (id === request.current) setFailure({ key, message: e instanceof ApiError ? e.message : 'Error' }); });
    // `key` is derived from the other three deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page, tick]);

  const current = result?.key === key ? result.data : null;
  const currentError = failure?.key === key ? failure.message : null;
  const loading = !current && !currentError;
  const pickedSet = new Set(picked.map(c => c.coCli));
  const full = picked.length >= CUSTOMERS_MAX;
  const totalPages = current ? Math.max(1, Math.ceil(current.total / PAGE_SIZE)) : 1;

  function toggle(c: PickedCustomer) {
    if (pickedSet.has(c.coCli)) onChange(picked.filter(p => p.coCli !== c.coCli));
    else if (!full) onChange([...picked, c]);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        aria-label="Buscar cliente"
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        placeholder="Buscar cliente por nombre o código"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className={`min-h-[44px] w-full max-w-md rounded-md border px-3 py-2 text-sm ${invalid ? 'border-red-500' : 'border-gray-300'} ${FOCUS}`}
      />

      {picked.length > 0 && (
        <ul aria-label="Clientes elegidos" className="flex flex-wrap gap-2">
          {picked.map(c => (
            <li key={c.coCli} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-sm text-blue-900">
              <span>{c.cliDes || c.coCli}</span>
              <button type="button" aria-label={`Quitar ${c.cliDes || c.coCli}`} onClick={() => onChange(picked.filter(p => p.coCli !== c.coCli))}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg leading-none hover:bg-blue-100 ${FOCUS}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="text-sm text-gray-600">
        {picked.length} {picked.length === 1 ? 'cliente elegido' : 'clientes elegidos'} (máx. {CUSTOMERS_MAX})
        {full && <span className="ml-1 text-amber-800">Alcanzaste el máximo</span>}
      </p>

      {currentError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{currentError}</span>
          <button type="button" onClick={() => setTick(t => t + 1)}
            className={`min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 ${FOCUS}`}>
            Reintentar
          </button>
        </div>
      )}

      <ul aria-label="Resultados de clientes" aria-busy={loading} className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
        {loading ? (
          [0, 1, 2].map(i => <li key={i} aria-hidden="true" className="px-3 py-3"><div className="h-5 animate-pulse rounded bg-gray-100" /></li>)
        ) : current && current.customers.length === 0 ? (
          <li className="px-3 py-4 text-sm text-gray-500">Sin resultados</li>
        ) : current?.customers.map(c => {
          const checked = pickedSet.has(c.coCli);
          return (
            <li key={c.coCli}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-gray-50">
                <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggle({ coCli: c.coCli, cliDes: c.cliDes })}
                  className={`h-4 w-4 rounded border-gray-300 ${FOCUS}`} />
                <span className="text-xs text-gray-500">{c.coCli}</span>
                <span className="text-sm text-gray-900">{c.cliDes}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {current && totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-gray-700">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className={`min-h-[44px] rounded-md border border-gray-300 bg-white px-3 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
            Anterior
          </button>
          <span>Página {page} de {totalPages} · {current.total} clientes</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className={`min-h-[44px] rounded-md border border-gray-300 bg-white px-3 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
