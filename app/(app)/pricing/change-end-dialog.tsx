'use client';
import { useState } from 'react';
import { Modal } from '@/components/modal';
import type { PromotionDetailDto } from '@/lib/pricing/client-types';
import { isValidIsoDate, todayIso } from '@/lib/pricing/dates';
import { DialogFooter, ErrorBox, INPUT, useSubmit } from './dialog-parts';
import { fmtDate } from './promo-format';

interface Props {
  detail: PromotionDetailDto;
  onConfirm: (endsOn: string) => Promise<void>;
  onClose: () => void;
}

export default function ChangeEndDialog({ detail, onConfirm, onClose }: Props) {
  const [endsOn, setEndsOn] = useState(detail.endsOn);
  const today = todayIso();
  const min = today > detail.startsOn ? today : detail.startsOn;
  const valid = isValidIsoDate(endsOn) && endsOn >= min && endsOn !== detail.endsOn;
  const { submitting, error, run } = useSubmit(() => onConfirm(endsOn));
  const shortening = isValidIsoDate(endsOn) && endsOn < detail.endsOn;
  return (
    <Modal title="Cambiar fecha de fin" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid && !submitting) void run(); }} className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">Promoción: <strong>{detail.name}</strong> · termina el {fmtDate(detail.endsOn)}</p>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Nueva fecha de fin</span>
          <input type="date" value={endsOn} min={min} onChange={e => setEndsOn(e.target.value)} className={INPUT} />
        </label>
        <p className="text-sm text-gray-600">
          {shortening
            ? 'Los precios promocionales terminan en la nueva fecha y desde el día siguiente rige la tarifa regular.'
            : 'Los precios promocionales se extienden hasta la nueva fecha, siempre que no choquen con otro cambio de tarifa.'}
          {detail.kind === 'segment' && ' Los clientes volverán a su segmento anterior cuando venza.'}
        </p>
        {error && <ErrorBox><span>{error.message}</span></ErrorBox>}
        <DialogFooter onClose={onClose} confirmLabel="Cambiar fecha" disabled={!valid} submitting={submitting} />
      </form>
    </Modal>
  );
}
