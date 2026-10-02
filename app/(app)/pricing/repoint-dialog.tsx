'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { PriceListDto, SegmentDto } from '@/lib/pricing/client-types';
import { ApiError } from './api-client';
import { DialogFooter, ErrorBox, useSubmit } from './dialog-parts';

interface Props {
  segment: SegmentDto;
  priceLists: PriceListDto[];
  onConfirm: (coPrecio: string) => Promise<void>;
  /** Re-fetches segments (used after a stale-validador 409). */
  onReload?: () => Promise<void>;
  onClose: () => void;
}

export default function RepointDialog({ segment, priceLists, onConfirm, onReload, onClose }: Props) {
  const [target, setTarget] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const options = useMemo(
    () => priceLists.filter(p => p.coPrecio !== segment.coPrecio).map(p => ({ value: p.coPrecio, label: `${p.desPrecio} (${p.coPrecio})` })),
    [priceLists, segment.coPrecio],
  );
  const next = priceLists.find(p => p.coPrecio === target);
  const { submitting, error, setError, run } = useSubmit(async () => { if (target) await onConfirm(target); });
  const stale = error instanceof ApiError && error.status === 409;

  async function reload() {
    if (!onReload) return;
    setReloading(true);
    try { await onReload(); setError(null); } finally { setReloading(false); }
  }

  return (
    <Modal title="Cambiar lista de precios" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">Segmento: <strong>{segment.desTipo}</strong></p>
        <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Nueva lista</span>
          <SearchableSelect value={target} onChange={setTarget} options={options} placeholder="Buscar lista" />
        </div>
        {next && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {segment.customerCount} {segment.customerCount === 1 ? 'cliente cambiará' : 'clientes cambiarán'} de «{segment.desPrecio ?? segment.coPrecio}» a «{next.desPrecio}»
          </p>
        )}
        {error && (
          <ErrorBox>
            <span>{error.message}</span>
            {stale && onReload && (
              <button type="button" onClick={() => void reload()} disabled={reloading}
                className="min-h-[44px] rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
                {reloading ? 'Recargando…' : 'Recargar'}
              </button>
            )}
          </ErrorBox>
        )}
        <DialogFooter onClose={onClose} confirmLabel="Cambiar lista" disabled={!target} submitting={submitting} />
      </form>
    </Modal>
  );
}
