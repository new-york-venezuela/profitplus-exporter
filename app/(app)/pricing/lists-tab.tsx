'use client';
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effects: loaders set loading/error state by design */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal } from '@/components/modal';
import { apiGet, apiSend, ApiError } from './api-client';
import type { ApplyResult, FilterOption, GridData, PriceListDto } from '@/lib/pricing/client-types';
import { bulkNewPrices } from '@/lib/pricing/rates-math';
import { pendingChanges, referenceFor, stageEdit, type BulkOp, type Staged } from '@/lib/pricing/rates-staging';
import { isValidIsoDate, todayIso } from '@/lib/pricing/dates';
import { nextTabId } from '@/lib/pricing/tab-nav';
import ListRail from './list-rail';
import RatesGrid from './rates-grid';
import ApplyDialog, { type ApplyChange } from './apply-dialog';
import NewListDialog, { type NewListBody } from './new-list-dialog';
import ArticleLookup from './article-lookup';
import { FOCUS } from './dialog-parts';

type DialogState = null | 'apply' | 'new' | 'clone';
type View = 'tarifas' | 'articulos';
const VIEWS: { id: View; label: string }[] = [{ id: 'tarifas', label: 'Tarifas' }, { id: 'articulos', label: 'Artículos' }];

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');
const BTN = `min-h-[44px] rounded-md px-4 text-sm font-medium ${FOCUS}`;

export default function ListsTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>('tarifas');
  const [lists, setLists] = useState<PriceListDto[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [loaded, setLoaded] = useState<{ co: string; data: GridData } | null>(null); // grid + the list it belongs to
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [staged, setStaged] = useState<Staged>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [discardNonce, setDiscardNonce] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [snapshot, setSnapshot] = useState<{ co: string; changes: ApplyChange[]; effectiveFrom: string } | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const gridReq = useRef(0);
  const listsReq = useRef(0);
  const viewRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectedCo = params.get('list');
  const selectedRef = useRef(selectedCo);
  useEffect(() => { selectedRef.current = selectedCo; }, [selectedCo]);
  const list = useMemo(() => lists.find(l => l.coPrecio === selectedCo) ?? null, [lists, selectedCo]);
  const grid = loaded?.co === selectedCo ? loaded.data : null;
  const closeDialog = useCallback(() => setDialog(null), []);

  // Reset grid, staged edits, selection and filters whenever the selected list changes
  // (click, back/forward, redirect): a stale grid must never show under another list.
  const [seenCo, setSeenCo] = useState(selectedCo);
  if (seenCo !== selectedCo) {
    setSeenCo(selectedCo);
    setLoaded(null);
    setGridError(null);
    setCompareTo(null);
    setStaged({});
    setSelectedRows(new Set());
    setSearch('');
    setCategory('');
    setShowUnpriced(false);
    setNotice(null);
    setDialog(null);
    setSnapshot(null);
    setPendingSwitch(null);
    setDiscardNonce(n => n + 1);
  }

  const loadLists = useCallback(async () => {
    const id = ++listsReq.current;
    try {
      const d = await apiGet<{ priceLists: PriceListDto[]; currencies: string[] }>('/api/pricing/lists');
      if (id !== listsReq.current) return;
      setLists(d.priceLists);
      setCurrencies(d.currencies);
      setListsError(null);
    } catch (e) { if (id === listsReq.current) setListsError(errMsg(e)); }
    finally { if (id === listsReq.current) setListsLoading(false); }
  }, []);

  useEffect(() => { void loadLists(); }, [loadLists]);

  function setListParam(co: string) {
    const next = new URLSearchParams(params.toString());
    next.set('list', co);
    router.replace(`/pricing?${next.toString()}`);
  }

  // Switching with unsent edits asks first (Modal, never window.confirm).
  function selectList(co: string) {
    if (co === selectedCo) return;
    if (Object.keys(staged).length > 0) setPendingSwitch(co);
    else setListParam(co);
  }

  // default selection: first list with rates (also when the URL points at an unknown list)
  useEffect(() => {
    if (lists.length === 0 || (selectedCo && list)) return;
    setListParam((lists.find(l => !l.isEmpty) ?? lists[0]).coPrecio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, selectedCo]);

  const loadGrid = useCallback(async () => {
    if (!selectedCo) return;
    const id = ++gridReq.current;
    setGridLoading(true);
    try {
      const q = compareTo ? `?compareTo=${encodeURIComponent(compareTo)}` : '';
      const data = await apiGet<GridData>(`/api/pricing/lists/${encodeURIComponent(selectedCo)}/rates${q}`);
      if (id !== gridReq.current) return; // stale response
      setLoaded({ co: selectedCo, data });
      const codes = new Set(data.rows.filter(r => !r.ambiguous).map(r => r.coArt));
      setSelectedRows(prev => (prev.size === 0 ? prev : new Set([...prev].filter(c => codes.has(c)))));
      setGridError(null);
    } catch (e) {
      if (id === gridReq.current) setGridError(errMsg(e));
    } finally {
      if (id === gridReq.current) setGridLoading(false);
    }
  }, [selectedCo, compareTo]);

  useEffect(() => { void loadGrid(); }, [loadGrid]);

  const compareOptions = useMemo<FilterOption[]>(
    () => lists.filter(l => l.coPrecio !== selectedCo).map(l => ({ value: l.coPrecio, label: `${l.coPrecio} · ${l.desPrecio}` })),
    [lists, selectedCo],
  );

  function onToggle(coArt: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(coArt)) next.delete(coArt); else next.add(coArt);
      return next;
    });
  }

  function onToggleAll(visible: string[], all: boolean) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      for (const c of visible) { if (all) next.add(c); else next.delete(c); }
      return next;
    });
  }

  function onBulk(op: BulkOp) {
    if (!grid) return;
    const rows = grid.rows.filter(r => selectedRows.has(r.coArt) && !r.ambiguous);
    const prices = bulkNewPrices(rows.map(r => ({ coArt: r.coArt, reference: referenceFor(r) })), op);
    setStaged(s => Object.entries(prices).reduce((acc, [coArt, monto]) => stageEdit(acc, coArt, monto), s));
    const skipped = rows.length - Object.keys(prices).length;
    setNotice(skipped > 0 ? `${skipped} ${skipped === 1 ? 'fila sin precio de referencia omitida' : 'filas sin precio de referencia omitidas'}` : null);
  }

  function onClear() {
    setStaged({});
    setNotice(null);
    setDiscardNonce(n => n + 1);
  }

  function onApply() {
    if (!grid || !selectedCo) return;
    if (!isValidIsoDate(effectiveFrom) || effectiveFrom < todayIso()) {
      setActionError('La fecha de vigencia no puede ser anterior a hoy');
      return;
    }
    const changes = pendingChanges(staged, grid.rows);
    if (changes.length === 0) return;
    setActionError(null);
    setSnapshot({ co: selectedCo, changes, effectiveFrom });
    setDialog('apply');
  }

  async function confirmApply(only?: string[]): Promise<ApplyResult[]> {
    if (!snapshot) return [];
    const co = snapshot.co;
    const changes = snapshot.changes.filter(c => !only || only.includes(c.coArt)).map(c => ({ coArt: c.coArt, monto: c.after }));
    const { results } = await apiSend<{ results: ApplyResult[] }>(
      `/api/pricing/lists/${encodeURIComponent(co)}/rates/apply`, 'POST', { effectiveFrom: snapshot.effectiveFrom, changes });
    if (selectedRef.current === co) {
      const done = new Set(results.filter(r => r.outcome === 'success' || r.outcome === 'skipped').map(r => r.coArt));
      setStaged(s => { const next = { ...s }; for (const c of done) delete next[c]; return next; });
      setDiscardNonce(n => n + 1);
      void loadGrid();
      void loadLists();
    }
    return results;
  }

  async function createList(body: NewListBody): Promise<PriceListDto> {
    const { priceList } = await apiSend<{ priceList: PriceListDto }>('/api/pricing/lists', 'POST', body);
    setDialog(null);
    setWarning(priceList.warning ?? null);
    await loadLists();
    selectList(priceList.coPrecio);
    return priceList;
  }

  function onViewKey(e: React.KeyboardEvent, id: View) {
    const target = nextTabId(VIEWS.map(v => v.id), id, e.key) as View | null;
    if (!target) return;
    e.preventDefault();
    setView(target);
    viewRefs.current[target]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Vista de listas" className="inline-flex w-fit rounded-md border border-gray-300 bg-white p-0.5">
        {VIEWS.map(v => (
          <button key={v.id} id={`lists-view-${v.id}`} ref={el => { viewRefs.current[v.id] = el; }} type="button" role="tab"
            aria-selected={view === v.id} aria-controls="lists-view-panel" tabIndex={view === v.id ? 0 : -1}
            onClick={() => setView(v.id)} onKeyDown={e => onViewKey(e, v.id)}
            className={`${BTN} ${view === v.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="lists-view-panel" aria-labelledby={`lists-view-${view}`} className="flex flex-col gap-4">
        {listsError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{listsError}</span>
            <button type="button" onClick={() => void loadLists()}
              className={`min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 ${FOCUS}`}>
              Reintentar
            </button>
          </div>
        )}
        {actionError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}
        {warning && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>{warning}</span>
            <button type="button" onClick={() => setWarning(null)}
              className={`min-h-[44px] rounded-md px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 ${FOCUS}`}>
              Cerrar
            </button>
          </div>
        )}

        {view === 'articulos' ? (
          <ArticleLookup lists={lists} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ListRail
              lists={lists}
              selected={selectedCo}
              onSelect={selectList}
              onNew={() => setDialog('new')}
              canEdit={canEdit}
              loading={listsLoading}
              showEmpty={showEmpty}
              onToggleEmpty={setShowEmpty}
            />
            <div className="flex min-w-0 flex-col gap-3">
              {notice && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</div>}
              <RatesGrid
                data={grid}
                loading={gridLoading || (Boolean(selectedCo) && !grid && !gridError)}
                error={gridError}
                staged={staged}
                onStage={(coArt, monto) => setStaged(s => stageEdit(s, coArt, monto))}
                selected={selectedRows}
                onToggle={onToggle}
                onToggleAll={onToggleAll}
                compareTo={compareTo}
                compareOptions={compareOptions}
                onCompareChange={setCompareTo}
                effectiveFrom={effectiveFrom}
                onEffectiveFromChange={setEffectiveFrom}
                canEdit={canEdit}
                search={search}
                onSearchChange={setSearch}
                category={category}
                onCategoryChange={setCategory}
                showUnpriced={showUnpriced}
                onShowUnpricedChange={setShowUnpriced}
                onBulk={onBulk}
                onClear={onClear}
                onApply={onApply}
                onClone={() => setDialog('clone')}
                onExport={() => { if (selectedCo) window.location.assign(`/api/pricing/lists/${encodeURIComponent(selectedCo)}/export`); }}
                discardNonce={discardNonce}
              />
            </div>
          </div>
        )}
      </div>

      {pendingSwitch && (
        <Modal title="Cambios sin aplicar" onClose={() => setPendingSwitch(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">Hay cambios sin aplicar. ¿Descartar?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingSwitch(null)} className={`${BTN} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>Seguir editando</button>
              <button type="button" onClick={() => { const co = pendingSwitch; setPendingSwitch(null); setListParam(co); }} className={`${BTN} bg-red-600 text-white hover:bg-red-700`}>Descartar</button>
            </div>
          </div>
        </Modal>
      )}
      {canEdit && dialog === 'apply' && snapshot && (
        <ApplyDialog changes={snapshot.changes} effectiveFrom={snapshot.effectiveFrom} onConfirm={confirmApply} onClose={closeDialog} />
      )}
      {canEdit && dialog === 'new' && (
        <NewListDialog lists={lists} currencies={currencies} mode="create" onConfirm={createList} onClose={closeDialog} />
      )}
      {canEdit && dialog === 'clone' && selectedCo && (
        <NewListDialog lists={lists} currencies={currencies} mode="clone" sourceCoPrecio={selectedCo} onConfirm={createList} onClose={closeDialog} />
      )}
    </div>
  );
}
