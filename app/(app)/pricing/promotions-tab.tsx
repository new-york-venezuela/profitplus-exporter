'use client';
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effects: loaders set loading/error state by design */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiSend, ApiError } from './api-client';
import type { PromotionDetailDto, PromotionDto } from '@/lib/pricing/client-types';
import PromotionList from './promotion-list';
import PromotionDetail from './promotion-detail';
import CancelPromotionDialog from './cancel-promotion-dialog';
import ChangeEndDialog from './change-end-dialog';
import PromotionWizardSlot from './promotion-wizard-slot';

type DialogState = null | 'cancel' | 'changeEnd';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');

export default function PromotionsTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawPromo = params.get('promo');
  const promoId = rawPromo && /^\d+$/.test(rawPromo) ? Number(rawPromo) : null;
  const newParam = params.get('new') === '1';

  const [promotions, setPromotions] = useState<PromotionDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromotionDetailDto | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null); // promotion the loaded detail belongs to
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [duplicate, setDuplicate] = useState<{ initial: unknown } | null>(null);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);

  // Reset detail + dialogs whenever the selected promotion changes (click, back/forward, redirect).
  const [seenId, setSeenId] = useState(promoId);
  if (seenId !== promoId) {
    setSeenId(promoId);
    setDetail(null);
    setDetailId(null);
    setDetailError(null);
    setDialog(null);
    setActionError(null);
  }
  const visibleDetail = detailId === promoId ? detail : null;
  const detailLoading = promoId !== null && detailId !== promoId && !detailError;
  const wizardOpen = canEdit && (newParam || duplicate !== null);

  const loadList = useCallback(async () => {
    const id = ++listRequest.current;
    try {
      const data = await apiGet<{ promotions: PromotionDto[] }>('/api/pricing/promotions');
      if (id !== listRequest.current) return;
      setPromotions(data.promotions);
      setListError(null);
    } catch (e) {
      if (id === listRequest.current) setListError(errMsg(e));
    } finally {
      if (id === listRequest.current) setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (promoId === null) return;
    const id = ++detailRequest.current;
    try {
      const data = await apiGet<{ promotion: PromotionDetailDto }>(`/api/pricing/promotions/${promoId}`);
      if (id !== detailRequest.current) return; // stale response
      setDetail(data.promotion);
      setDetailId(promoId);
      setDetailError(null);
    } catch (e) {
      if (id === detailRequest.current) setDetailError(errMsg(e));
    }
  }, [promoId]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const closeDialog = useCallback(() => setDialog(null), []);

  function setUrl(patch: { promo?: number | null; new?: boolean }) {
    const next = new URLSearchParams(params.toString());
    if (patch.promo !== undefined) { if (patch.promo === null) next.delete('promo'); else next.set('promo', String(patch.promo)); }
    if (patch.new !== undefined) { if (patch.new) next.set('new', '1'); else next.delete('new'); }
    router.replace(`/pricing?${next.toString()}`);
  }

  function closeWizard() {
    setDuplicate(null);
    if (newParam) setUrl({ new: false });
  }

  async function reload() { await Promise.all([loadList(), loadDetail()]); }

  async function cancelPromotion() {
    if (promoId === null) return;
    await apiSend(`/api/pricing/promotions/${promoId}`, 'PATCH', { action: 'cancel' });
    setDialog(null);
    await reload();
  }

  async function changeEnd(endsOn: string) {
    if (promoId === null) return;
    await apiSend(`/api/pricing/promotions/${promoId}`, 'PATCH', { action: 'change_end', endsOn });
    setDialog(null);
    await reload();
  }

  async function retry() {
    if (promoId === null || retrying) return;
    setRetrying(true);
    setActionError(null);
    try {
      await apiSend(`/api/pricing/promotions/${promoId}/retry`, 'POST', {});
    } catch (e) { setActionError(errMsg(e)); }
    try { await reload(); } finally { setRetrying(false); }
  }

  function startDuplicate() {
    if (!visibleDetail) return;
    setDuplicate({
      initial: {
        name: visibleDetail.name, reason: visibleDetail.reason, kind: visibleDetail.kind,
        coPrecio: visibleDetail.coPrecio, baseCoPrecio: visibleDetail.baseCoPrecio,
        items: visibleDetail.items.map(i => ({ coArt: i.coArt, artDes: i.artDes, promoMonto: i.promoMonto })),
        customers: visibleDetail.customers.map(c => ({ coCli: c.coCli, cliDes: c.cliDes })),
      },
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <PromotionList
        promotions={promotions}
        selectedId={promoId}
        onSelect={id => { setDuplicate(null); setUrl({ promo: id, new: false }); }}
        loading={listLoading}
        error={listError}
        onNew={() => { setDuplicate(null); setUrl({ new: true }); }}
        canEdit={canEdit}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {actionError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        )}
        {wizardOpen ? (
          <PromotionWizardSlot
            initial={duplicate?.initial}
            onDone={id => { setDuplicate(null); setUrl({ promo: id, new: false }); void loadList(); }}
            onCancel={closeWizard}
          />
        ) : promoId === null ? (
          !listLoading && <p className="text-sm text-gray-500">Selecciona una promoción para ver su detalle</p>
        ) : (
          <PromotionDetail
            detail={visibleDetail}
            loading={detailLoading}
            error={detailError}
            canEdit={canEdit}
            onCancel={() => setDialog('cancel')}
            onChangeEnd={() => setDialog('changeEnd')}
            onRetry={() => void retry()}
            onDuplicate={startDuplicate}
            retrying={retrying}
          />
        )}
      </div>

      {canEdit && dialog === 'cancel' && visibleDetail && (
        <CancelPromotionDialog detail={visibleDetail} onConfirm={cancelPromotion} onClose={closeDialog} />
      )}
      {canEdit && dialog === 'changeEnd' && visibleDetail && (
        <ChangeEndDialog detail={visibleDetail} onConfirm={changeEnd} onClose={closeDialog} />
      )}
    </div>
  );
}
