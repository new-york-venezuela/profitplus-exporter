'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { PriceListDto, SegmentDto } from '@/lib/pricing/client-types';
import { buildSegmentName } from '@/lib/pricing/segment-name';
import { addDaysIso, isValidIsoDate, todayIso } from '@/lib/pricing/dates';
import { DialogFooter, ErrorBox, INPUT, useSubmit } from './dialog-parts';

interface Props {
  customer: { coCli: string; cliDes: string };
  currentSegment: SegmentDto;
  segments: SegmentDto[];
  priceLists: PriceListDto[];
  onConfirm: (input: { reason: string; expiresOn: string; coPrecio: string; fallbackTipCli: string }) => Promise<void>;
  onClose: () => void;
}

export default function SpecialPriceDialog({ customer, currentSegment, segments, priceLists, onConfirm, onClose }: Props) {
  const today = todayIso();
  // Browser-local date; production runs in Venezuelan local time on the server too, so no UTC off-by-one handling (ruling).
  const tomorrow = addDaysIso(today, 1);
  const [reason, setReason] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [coPrecio, setCoPrecio] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(currentSegment.kind === 'special' ? null : currentSegment.tipCli);

  const listOptions = useMemo(
    () => priceLists.map(p => ({ value: p.coPrecio, label: `${p.desPrecio} (${p.coPrecio})` })),
    [priceLists],
  );
  const segmentOptions = useMemo(
    () => segments.filter(s => s.kind !== 'special').map(s => ({ value: s.tipCli, label: s.desTipo })),
    [segments],
  );

  const dateOk = isValidIsoDate(expiresOn) && expiresOn >= tomorrow;
  const trimmedReason = reason.trim();
  const preview = dateOk
    ? buildSegmentName({ customerName: customer.cliDes, reason: trimmedReason, endsOn: expiresOn, today })
    : null;
  const { submitting, error, run } = useSubmit(async () => {
    if (coPrecio && fallback) await onConfirm({ reason: trimmedReason, expiresOn, coPrecio, fallbackTipCli: fallback });
  });

  return (
    <Modal title="Precio especial" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        <div className="text-sm text-gray-700">
          <span className="text-xs font-medium text-gray-600">Cliente</span>
          <p className="font-medium text-gray-900">{customer.cliDes} <span className="text-xs font-normal text-gray-500">{customer.coCli}</span></p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Motivo
          <input type="text" value={reason} maxLength={40} onChange={e => setReason(e.target.value)} className={INPUT} autoFocus />
          <span className="font-normal text-gray-500">{reason.length}/40</span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Fecha de fin
          <input type="date" value={expiresOn} min={tomorrow} onChange={e => setExpiresOn(e.target.value)} className={INPUT} />
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Lista de precios</span>
          <SearchableSelect value={coPrecio} onChange={setCoPrecio} options={listOptions} placeholder="Buscar lista" ariaLabel="Lista de precios" />
        </div>
        <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Segmento de respaldo (al vencer)</span>
          <SearchableSelect value={fallback} onChange={setFallback} options={segmentOptions} placeholder="Buscar segmento" ariaLabel="Segmento de respaldo" />
        </div>
        {preview && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">Nombre en Profit: <strong>{preview}</strong></p>
        )}
        {error && <ErrorBox>{error.message}</ErrorBox>}
        <DialogFooter
          onClose={onClose}
          confirmLabel="Crear precio especial"
          disabled={!trimmedReason || !dateOk || !coPrecio || !fallback}
          submitting={submitting}
        />
      </form>
    </Modal>
  );
}
