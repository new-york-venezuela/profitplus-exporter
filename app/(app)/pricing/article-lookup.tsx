'use client';
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effects: loaders set loading/error state by design */
import { useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import type { ArticlePrices, ArticleRow, CustomerPage, PriceListDto } from '@/lib/pricing/client-types';
import { apiGet, ApiError } from './api-client';
import { FOCUS } from './dialog-parts';
import { useDebounced } from './use-debounced';

const NUM = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => NUM.format(n);
const dmy = (iso: string) => iso.split('-').reverse().join('/');
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');
const FIELD = `min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS}`;

export default function ArticleLookup({ lists }: { lists: PriceListDto[] }) {
  const [term, setTerm] = useState('');
  const debouncedTerm = useDebounced(term.trim(), 300);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleRow | null>(null);

  const [custTerm, setCustTerm] = useState('');
  const debouncedCust = useDebounced(custTerm.trim(), 300);
  const [custOptions, setCustOptions] = useState<{ value: string; label: string }[]>([]);
  const [customer, setCustomer] = useState<{ value: string; label: string } | null>(null);

  const [prices, setPrices] = useState<ArticlePrices | null>(null);
  const [pricesFor, setPricesFor] = useState<string | null>(null); // `${coArt}|${customer}` the loaded prices belong to
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  const searchId = useRef(0);
  const custId = useRef(0);
  const priceId = useRef(0);
  const listByCode = useMemo(() => new Map(lists.map(l => [l.coPrecio, l])), [lists]);

  useEffect(() => {
    const id = ++searchId.current;
    if (!debouncedTerm) { setArticles([]); setSearching(false); setSearchError(null); return; }
    setSearching(true);
    apiGet<{ articles: ArticleRow[] }>(`/api/pricing/articles?search=${encodeURIComponent(debouncedTerm)}`)
      .then(d => { if (id === searchId.current) { setArticles(d.articles); setSearchError(null); } })
      .catch(e => { if (id === searchId.current) setSearchError(errMsg(e)); })
      .finally(() => { if (id === searchId.current) setSearching(false); });
  }, [debouncedTerm]);

  useEffect(() => {
    const id = ++custId.current;
    if (!debouncedCust) { setCustOptions([]); return; }
    apiGet<CustomerPage>(`/api/pricing/customers?search=${encodeURIComponent(debouncedCust)}&pageSize=20`)
      .then(d => { if (id === custId.current) setCustOptions(d.customers.map(c => ({ value: c.coCli, label: `${c.cliDes} (${c.coCli})` }))); })
      .catch(() => { if (id === custId.current) setCustOptions([]); });
  }, [debouncedCust]);

  const coArt = article?.coArt ?? null;
  const coCli = customer?.value ?? null;
  const key = coArt ? `${coArt}|${coCli ?? ''}` : null;
  useEffect(() => {
    const id = ++priceId.current;
    if (!coArt) { setPrices(null); setPricesFor(null); setPricesError(null); setPricesLoading(false); return; }
    setPricesLoading(true);
    setPricesError(null);
    const q = coCli ? `?customer=${encodeURIComponent(coCli)}` : '';
    apiGet<ArticlePrices>(`/api/pricing/articles/${encodeURIComponent(coArt)}/prices${q}`)
      .then(d => { if (id === priceId.current) { setPrices(d); setPricesFor(`${coArt}|${coCli ?? ''}`); } })
      .catch(e => { if (id === priceId.current) setPricesError(errMsg(e)); })
      .finally(() => { if (id === priceId.current) setPricesLoading(false); });
  }, [coArt, coCli]);

  const custSelectOptions = useMemo(
    () => (customer && !custOptions.some(o => o.value === customer.value) ? [customer, ...custOptions] : custOptions),
    [customer, custOptions],
  );
  // Never show prices that belong to another article/customer than the one selected.
  const visible = pricesFor === key ? prices : null;

  return (
    <section aria-label="Consulta de artículo" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <input type="search" aria-label="Buscar artículo" placeholder="Código o nombre del artículo" value={term}
            onChange={e => setTerm(e.target.value)} className={`${FIELD} w-full`} />
          {searchError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</div>}
          {searching ? (
            <p className="text-sm text-gray-500" aria-busy="true">Buscando…</p>
          ) : debouncedTerm && articles.length === 0 && !searchError ? (
            <p className="text-sm text-gray-500">Sin resultados</p>
          ) : (
            <ul aria-label="Resultados de artículos" className="flex max-h-96 flex-col gap-1 overflow-auto">
              {articles.map(a => (
                <li key={a.coArt}>
                  <button type="button" onClick={() => setArticle(a)} aria-current={article?.coArt === a.coArt ? 'true' : undefined}
                    className={`flex min-h-[44px] w-full flex-col items-start rounded-md border px-3 py-2 text-left ${FOCUS} ${
                      article?.coArt === a.coArt ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}>
                    <span className="text-sm font-medium text-gray-900">{a.artDes}</span>
                    <span className="text-xs text-gray-500">{a.coArt}{a.catDes ? ` · ${a.catDes}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {!article ? (
            <p className="text-sm text-gray-500">Busca y selecciona un artículo para ver su precio en cada lista</p>
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-900">{article.artDes} <span className="text-xs font-normal text-gray-500">{article.coArt}</span></h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  Buscar cliente (opcional)
                  <input type="search" aria-label="Buscar cliente" placeholder="Nombre, código o RIF" value={custTerm}
                    onChange={e => setCustTerm(e.target.value)} className={`${FIELD} w-56`} />
                </label>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  <span>Cliente</span>
                  <SearchableSelect value={coCli} onChange={v => setCustomer(v ? custSelectOptions.find(o => o.value === v) ?? null : null)}
                    options={custSelectOptions} allLabel="Sin cliente" placeholder="Elegir cliente" ariaLabel="Cliente" className="w-64" />
                </div>
              </div>
              {pricesError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pricesError}</div>}
              {visible?.effective && (
                <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
                  Precio efectivo para <strong>{visible.effective.cliDes}</strong>: <strong>{fmt(visible.effective.monto)}</strong>{' '}
                  (lista {visible.effective.coPrecio} · {visible.effective.desPrecio})
                </p>
              )}
              {visible && coCli && !visible.effective && (
                <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  El cliente no tiene un precio vigente para este artículo en su lista.
                </p>
              )}
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">Lista</th>
                      <th scope="col" className="px-3 py-2">Moneda</th>
                      <th scope="col" className="px-3 py-2 text-right">Vigente</th>
                      <th scope="col" className="px-3 py-2">Próximo</th>
                      <th scope="col" className="px-3 py-2">Historial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pricesLoading && !visible ? (
                      <tr aria-hidden="true"><td colSpan={5} className="px-3 py-2"><div className="h-8 animate-pulse rounded bg-gray-100" /></td></tr>
                    ) : !visible || visible.lists.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Este artículo no tiene tarifas en ninguna lista</td></tr>
                    ) : visible.lists.map(l => (
                      <tr key={l.coPrecio} className="align-top">
                        <td className="px-3 py-2">{l.coPrecio} · {listByCode.get(l.coPrecio)?.desPrecio ?? l.desPrecio}</td>
                        <td className="px-3 py-2">{l.coMone ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {l.current ? <>{fmt(l.current.monto)} <span className="block text-xs text-gray-500">desde {dmy(l.current.desde)}</span></> : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {l.next ? <>{fmt(l.next.monto)} <span className="text-xs text-gray-500">desde {dmy(l.next.desde)}</span></> : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {l.history.length === 0 ? '—' : (
                            <details>
                              <summary className={`cursor-pointer text-blue-700 ${FOCUS}`}>{l.history.length} anteriores</summary>
                              <ul className="mt-1 text-xs text-gray-700">
                                {l.history.map(h => (
                                  <li key={`${h.desde}`} className="tabular-nums">{h.hasta ? `${dmy(h.desde)} – ${dmy(h.hasta)}` : `desde ${dmy(h.desde)}`}: {fmt(h.monto)}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
