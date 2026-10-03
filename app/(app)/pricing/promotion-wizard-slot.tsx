'use client';
/* eslint-disable react-hooks/set-state-in-effect -- data-fetching effect: the loader sets loading/error state by design */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PriceListDto } from '@/lib/pricing/client-types';
import { apiGet, ApiError } from './api-client';
import { ErrorBox, FOCUS } from './dialog-parts';
import PromotionWizard from './promotion-wizard';
import type { WizardPrefill } from './wizard-prefill';

interface Props { initial?: WizardPrefill; onDone: (id: number) => void; onCancel: () => void }

/** Loads the price lists the wizard needs, then renders it. Unmounting (cancel/done) discards all wizard state. */
export default function PromotionWizardSlot({ initial, onDone, onCancel }: Props) {
  const [lists, setLists] = useState<PriceListDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const d = await apiGet<{ priceLists: PriceListDto[] }>('/api/pricing/price-lists');
      if (id !== request.current) return;
      setLists(d.priceLists);
      setError(null);
    } catch (e) {
      if (id === request.current) setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (lists) return <PromotionWizard initial={initial} priceLists={lists} onDone={onDone} onCancel={onCancel} />;
  return (
    <div className="flex flex-col items-start gap-3">
      {error ? (
        <ErrorBox>
          <span>{error}</span>
          <button type="button" onClick={() => void load()}
            className={`min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 ${FOCUS}`}>
            Reintentar
          </button>
        </ErrorBox>
      ) : (
        <div role="status" aria-busy="true" className="text-sm text-gray-600">Cargando listas de precio…</div>
      )}
      <button type="button" onClick={onCancel}
        className={`min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`}>
        Cancelar
      </button>
    </div>
  );
}
