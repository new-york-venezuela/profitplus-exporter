'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { PriceListDto } from '@/lib/pricing/client-types';
import { DialogFooter, ErrorBox, INPUT, useSubmit } from './dialog-parts';

interface Props {
  priceLists: PriceListDto[];
  onConfirm: (input: { desTipo: string; coPrecio: string }) => Promise<void>;
  onClose: () => void;
}

export default function NewSegmentDialog({ priceLists, onConfirm, onClose }: Props) {
  const [name, setName] = useState('');
  const [coPrecio, setCoPrecio] = useState<string | null>(null);
  const options = useMemo(
    () => priceLists.map(p => ({ value: p.coPrecio, label: `${p.desPrecio} (${p.coPrecio})` })),
    [priceLists],
  );
  const trimmed = name.trim();
  const { submitting, error, run } = useSubmit(async () => {
    if (coPrecio) await onConfirm({ desTipo: trimmed, coPrecio });
  });

  return (
    <Modal title="Nuevo segmento" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre
          <input type="text" value={name} maxLength={60} onChange={e => setName(e.target.value)} className={INPUT} autoFocus />
          <span className="font-normal text-gray-500">{name.length}/60</span>
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span>Lista de precios</span>
          <SearchableSelect value={coPrecio} onChange={setCoPrecio} options={options} placeholder="Buscar lista" />
        </div>
        {error && <ErrorBox>{error.message}</ErrorBox>}
        <DialogFooter onClose={onClose} confirmLabel="Crear segmento" disabled={!trimmed || !coPrecio} submitting={submitting} />
      </form>
    </Modal>
  );
}
