'use client';
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effects: loaders set loading/error state by design */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiSend, ApiError } from './api-client';
import type { CustomerPage, FilterOption, PriceListDto, SegmentDto, SegmentMoveResult } from '@/lib/pricing/client-types';
import type { CustomerSortKey } from '@/lib/pricing/customers-query';
import SegmentRail from './segment-rail';
import CustomerPanel, { type CustomerPanelFilters } from './customer-panel';
import MoveDialog from './move-dialog';
import RepointDialog from './repoint-dialog';
import NewSegmentDialog from './new-segment-dialog';
import SpecialPriceDialog from './special-price-dialog';
import ResultsPanel from './results-panel';
import { useDebounced } from './use-debounced';

type DialogState = null | 'move' | 'repoint' | 'new' | 'special';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');

export default function SegmentsTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListDto[]>([]);
  const [zonas, setZonas] = useState<FilterOption[]>([]);
  const [vendedores, setVendedores] = useState<FilterOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [page, setPage] = useState<CustomerPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    search: string; zona: string; vendedor: string; sort: CustomerSortKey; dir: 'asc' | 'desc'; page: number;
  }>({ search: '', zona: '', vendedor: '', sort: 'cliDes', dir: 'asc', page: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [results, setResults] = useState<SegmentMoveResult[] | null>(null);
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Names of every customer seen so far, so results can still show names after the page refreshes.
  const [names, setNames] = useState<Record<string, string>>({});
  const requestId = useRef(0);

  const debouncedSearch = useDebounced(filters.search, 300);
  const selectedTip = params.get('segment');
  const segment = useMemo(() => segments.find(s => s.tipCli === selectedTip) ?? null, [segments, selectedTip]);
  const closeDialog = useCallback(() => setDialog(null), []);

  const loadSegments = useCallback(async () => {
    try {
      setSegments((await apiGet<{ segments: SegmentDto[] }>('/api/pricing/segments')).segments);
      setSegmentsError(null);
    } catch (e) { setSegmentsError(errMsg(e)); }
    finally { setSegmentsLoading(false); }
  }, []);

  useEffect(() => {
    void loadSegments();
    apiGet<{ priceLists: PriceListDto[] }>('/api/pricing/price-lists').then(d => setPriceLists(d.priceLists)).catch(() => {});
    apiGet<{ zonas: FilterOption[]; vendedores: FilterOption[] }>('/api/pricing/customer-filters')
      .then(d => { setZonas(d.zonas); setVendedores(d.vendedores); }).catch(() => {});
  }, [loadSegments]);

  function selectSegment(tipCli: string) {
    const next = new URLSearchParams(params.toString());
    next.set('segment', tipCli);
    router.replace(`/pricing?${next.toString()}`);
    setSelected(new Set());
    setFilters(f => ({ ...f, page: 1 }));
  }

  // default selection: first segment (also when the URL points at an unknown segment)
  useEffect(() => {
    if (segments.length > 0 && (!selectedTip || !segment)) selectSegment(segments[0].tipCli);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, selectedTip]);

  const loadCustomers = useCallback(async () => {
    if (!selectedTip) return;
    const id = ++requestId.current;
    setPageLoading(true);
    const q = new URLSearchParams({ tipCli: selectedTip, sort: filters.sort, dir: filters.dir, page: String(filters.page) });
    if (debouncedSearch) q.set('search', debouncedSearch);
    if (filters.zona) q.set('zona', filters.zona);
    if (filters.vendedor) q.set('vendedor', filters.vendedor);
    try {
      const data = await apiGet<CustomerPage>(`/api/pricing/customers?${q}`);
      if (id !== requestId.current) return; // stale response
      setPage(data);
      setNames(n => ({ ...n, ...Object.fromEntries(data.customers.map(c => [c.coCli, c.cliDes])) }));
      setPageError(null);
    } catch (e) {
      if (id === requestId.current) setPageError(errMsg(e));
    } finally {
      if (id === requestId.current) setPageLoading(false);
    }
  }, [selectedTip, filters.sort, filters.dir, filters.page, filters.zona, filters.vendedor, debouncedSearch]);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  function onFiltersChange(patch: Partial<CustomerPanelFilters>) {
    setFilters(f => ({ ...f, ...patch }));
    setSelected(new Set()); // selection is always a subset of the visible page
  }

  function onToggle(coCli: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(coCli)) next.delete(coCli); else next.add(coCli);
      return next;
    });
  }

  // onTogglePage(false) clears the entire selection (selection never leaves the visible page)
  function onTogglePage(all: boolean) {
    setSelected(all ? new Set((page?.customers ?? []).map(c => c.coCli)) : new Set());
  }

  async function moveCustomers(codes: string[], targetTipCli: string) {
    const { results } = await apiSend<{ results: SegmentMoveResult[] }>('/api/pricing/assignments', 'POST', { customerCodes: codes, targetTipCli });
    setLastTarget(targetTipCli);
    setResults(results);
    setSelected(new Set());
    setDialog(null);
    await Promise.all([loadSegments(), loadCustomers()]);
  }

  async function retry(codes: string[]) {
    if (!lastTarget) return;
    setActionError(null);
    try { await moveCustomers(codes, lastTarget); }
    catch (e) { setActionError(errMsg(e)); }
  }

  const specialCustomerCode = selected.size === 1 ? [...selected][0] : null;
  const specialCustomer = specialCustomerCode
    ? { coCli: specialCustomerCode, cliDes: names[specialCustomerCode] ?? specialCustomerCode }
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SegmentRail
        segments={segments}
        selected={selectedTip}
        onSelect={selectSegment}
        onNew={() => setDialog('new')}
        canEdit={canEdit}
        loading={segmentsLoading}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {segmentsError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{segmentsError}</span>
            <button type="button" onClick={() => void loadSegments()}
              className="min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Reintentar
            </button>
          </div>
        )}
        {actionError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        )}
        {results && results.length > 0 && (
          <ResultsPanel results={results} nameByCode={names} onRetry={codes => void retry(codes)} onDismiss={() => setResults(null)} />
        )}
        {segment ? (
          <CustomerPanel
            segment={segment}
            page={page}
            loading={pageLoading}
            error={pageError}
            filters={filters}
            onFiltersChange={onFiltersChange}
            zonas={zonas}
            vendedores={vendedores}
            selected={selected}
            onToggle={onToggle}
            onTogglePage={onTogglePage}
            canEdit={canEdit}
            onRepoint={() => setDialog('repoint')}
            onMove={() => setDialog('move')}
            onSpecial={() => setDialog('special')}
          />
        ) : (
          !segmentsLoading && !segmentsError && (
            <p className="text-sm text-gray-500">Selecciona un segmento para ver sus clientes</p>
          )
        )}
      </div>

      {canEdit && dialog === 'move' && segment && (
        <MoveDialog
          segments={segments}
          currentTipCli={segment.tipCli}
          selectedCount={selected.size}
          onConfirm={t => moveCustomers([...selected], t)}
          onClose={closeDialog}
        />
      )}
      {canEdit && dialog === 'repoint' && segment && (
        <RepointDialog
          segment={segment}
          priceLists={priceLists}
          onReload={loadSegments}
          onConfirm={async coPrecio => {
            await apiSend(`/api/pricing/segments/${segment.tipCli}`, 'PATCH', { coPrecio, validador: segment.validador });
            setDialog(null);
            await loadSegments();
          }}
          onClose={closeDialog}
        />
      )}
      {canEdit && dialog === 'new' && (
        <NewSegmentDialog
          priceLists={priceLists}
          onConfirm={async b => {
            const r = await apiSend<{ segment: SegmentDto }>('/api/pricing/segments', 'POST', { kind: 'group', ...b });
            setDialog(null);
            await loadSegments();
            selectSegment(r.segment.tipCli);
          }}
          onClose={closeDialog}
        />
      )}
      {canEdit && dialog === 'special' && segment && specialCustomer && (
        <SpecialPriceDialog
          customer={specialCustomer}
          currentSegment={segment}
          segments={segments}
          priceLists={priceLists}
          onConfirm={async i => {
            const r = await apiSend<{ segment: SegmentDto; move?: SegmentMoveResult }>('/api/pricing/segments', 'POST',
              { kind: 'special', customerCoCli: specialCustomer.coCli, ...i });
            setDialog(null);
            if (r.move && r.move.outcome !== 'success') {
              setLastTarget(r.segment.tipCli);
              setResults([r.move]);
            }
            setSelected(new Set());
            await Promise.all([loadSegments(), loadCustomers()]);
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
