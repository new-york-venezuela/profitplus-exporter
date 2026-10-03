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
import type { WizardPrefill } from './wizard-prefill';

type DialogState = null | 'cancel' | 'changeEnd';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error');

/** Follow-up after Cambiar fecha de fin: nothing moved → repeat it; some items behind the new end → Reintentar. */
function changeEndNotice(p: PromotionDetailDto, requested: string): string | null {
  if (p.endsOn !== requested) {
    return 'No se pudo cambiar la fecha de fin; revisa los mensajes de los artículos y repite Cambiar fecha de fin';
  }
  const behind = p.items.some(i => i.appliedFrom !== null && i.cancelledOn === null && i.appliedTo !== p.endsOn);
  return behind ? 'El cambio de fecha quedó incompleto en algunos artículos; usa Reintentar' : null;
}

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
  const [duplicate, setDuplicate] = useState<{ initial: WizardPrefill } | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // amber follow-up note after a mutation
  const promoRef = useRef(promoId);
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
    setNotice(null);
    setDuplicate(null);
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
    const id = ++detailRequest.current; // bump first so a late response for a deselected promotion is ignored
    if (promoId === null) return;
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

  useEffect(() => { promoRef.current = promoId; }, [promoId]);
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

  // Adopts the mutation response (the only place the server's `warning` is carried) as the current detail.
  function adopt(id: number, promotion: PromotionDetailDto) {
    if (promoRef.current !== id) return;
    detailRequest.current++; // invalidate any in-flight GET that would overwrite the warning
    setDetail(promotion);
    setDetailId(id);
    setDetailError(null);
  }

  async function cancelPromotion() {
    if (promoId === null) return;
    const id = promoId;
    const { promotion } = await apiSend<{ promotion: PromotionDetailDto }>(`/api/pricing/promotions/${id}`, 'PATCH', { action: 'cancel' });
    setDialog(null);
    if (promoRef.current === id) {
      setActionError(null);
      setNotice(promotion.status !== 'cancelled'
        ? 'La cancelación quedó incompleta; vuelve a pulsar Cancelar para completarla' : null);
    }
    adopt(id, promotion);
    void loadList();
  }

  async function changeEnd(endsOn: string) {
    if (promoId === null) return;
    const id = promoId;
    const { promotion } = await apiSend<{ promotion: PromotionDetailDto }>(`/api/pricing/promotions/${id}`, 'PATCH', { action: 'change_end', endsOn });
    setDialog(null);
    if (promoRef.current === id) {
      setActionError(null);
      setNotice(changeEndNotice(promotion, endsOn));
    }
    adopt(id, promotion);
    void loadList();
  }

  async function retry() {
    if (promoId === null || retrying) return;
    const id = promoId;
    setRetrying(true);
    setActionError(null);
    setNotice(null);
    try {
      const { promotion } = await apiSend<{ promotion: PromotionDetailDto }>(`/api/pricing/promotions/${id}/retry`, 'POST', {});
      adopt(id, promotion);
    } catch (e) {
      if (promoRef.current === id) { setActionError(errMsg(e)); void loadDetail(); }
    } finally { setRetrying(false); }
    void loadList();
  }

  function startDuplicate() {
    if (!visibleDetail) return;
    setActionError(null);
    setNotice(null);
    setDuplicate({
      initial: {
        name: visibleDetail.name, reason: visibleDetail.reason, kind: visibleDetail.kind,
        coPrecio: visibleDetail.coPrecio, baseCoPrecio: visibleDetail.baseCoPrecio,
        items: visibleDetail.items.map(i => ({ coArt: i.coArt, monto: i.promoMonto })),
        customers: visibleDetail.customers.map(c => ({ coCli: c.coCli })),
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
        onNew={() => { setDuplicate(null); setActionError(null); setNotice(null); setUrl({ new: true }); }}
        canEdit={canEdit}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {actionError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        )}
        {notice && !wizardOpen && (
          <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</div>
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
            onCancel={() => { setActionError(null); setDialog('cancel'); }}
            onChangeEnd={() => { setActionError(null); setDialog('changeEnd'); }}
            onRetry={() => void retry()}
            onDuplicate={startDuplicate}
            onReload={() => void loadDetail()}
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
