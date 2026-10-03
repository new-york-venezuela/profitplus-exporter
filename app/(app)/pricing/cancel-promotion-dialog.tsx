'use client';
import { Modal } from '@/components/modal';
import type { PromotionDetailDto } from '@/lib/pricing/client-types';
import { ErrorBox, FOCUS, useSubmit } from './dialog-parts';

interface Props {
  detail: PromotionDetailDto;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function CancelPromotionDialog({ detail, onConfirm, onClose }: Props) {
  const { submitting, error, run } = useSubmit(onConfirm);
  const close = () => { if (!submitting) onClose(); }; // no dismiss while a request is in flight
  const scheduled = detail.status === 'scheduled';
  return (
    <Modal title="Cancelar promoción" onClose={close}>
      <form onSubmit={e => { e.preventDefault(); if (!submitting) void run(); }} className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">Promoción: <strong>{detail.name}</strong></p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>{scheduled
            ? 'La promoción aún no ha empezado: los precios regulares no cambiarán.'
            : 'Los precios vuelven a la tarifa regular desde hoy.'}</li>
          {detail.kind === 'segment' && <li>Los clientes vuelven a su segmento anterior.</li>}
          <li>Esta acción no se puede deshacer; para repetirla tendrías que crear una promoción nueva.</li>
        </ul>
        {error && <ErrorBox><span>{error.message}</span></ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close}
            className={`min-h-[44px] rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`}>
            Volver
          </button>
          <button type="submit" disabled={submitting}
            className={`min-h-[44px] rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
            {submitting ? 'Cancelando…' : 'Cancelar promoción'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
