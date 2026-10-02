'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { SegmentDto } from '@/lib/pricing/client-types';
import { DialogFooter, ErrorBox, useSubmit } from './dialog-parts';

interface Props {
  segments: SegmentDto[];
  currentTipCli: string;
  selectedCount: number;
  onConfirm: (targetTipCli: string) => Promise<void>;
  onClose: () => void;
}

export default function MoveDialog({ segments, currentTipCli, selectedCount, onConfirm, onClose }: Props) {
  const [target, setTarget] = useState<string | null>(null);
  const current = segments.find(s => s.tipCli === currentTipCli);
  const dest = segments.find(s => s.tipCli === target);
  const options = useMemo(
    () => segments.filter(s => s.tipCli !== currentTipCli).map(s => ({ value: s.tipCli, label: s.desTipo })),
    [segments, currentTipCli],
  );
  const { submitting, error, run } = useSubmit(async () => { if (target) await onConfirm(target); });
  const listName = (s?: SegmentDto) => (s ? (s.desPrecio ?? s.coPrecio) : '');

  return (
    <Modal title="Mover a segmento" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          <span id="move-target-label">Segmento destino</span>
          <SearchableSelect value={target} onChange={setTarget} options={options} placeholder="Buscar segmento" />
        </div>
        {dest && current && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <p>
              Se moverán {selectedCount} {selectedCount === 1 ? 'cliente' : 'clientes'} de «{current.desTipo}» → «{dest.desTipo}»
            </p>
            <p>Lista: {listName(current)} → {listName(dest)}</p>
          </div>
        )}
        {error && <ErrorBox>{error.message}</ErrorBox>}
        <DialogFooter onClose={onClose} confirmLabel="Mover" disabled={!target} submitting={submitting} />
      </form>
    </Modal>
  );
}
