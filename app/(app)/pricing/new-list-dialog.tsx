'use client';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { PriceListDto } from '@/lib/pricing/client-types';
import { parsePercentInput } from '@/lib/pricing/rates-math';
import { isValidIsoDate, todayIso } from '@/lib/pricing/dates';
import { DialogFooter, ErrorBox, INPUT, useSubmit } from './dialog-parts';

export type NewListBody =
  | { mode: 'create'; desPrecio: string; coMone: string }
  | { mode: 'clone'; sourceCoPrecio: string; desPrecio: string; percent: number | null; effectiveFrom: string };

interface Props {
  lists: PriceListDto[];
  currencies: string[];
  mode: 'create' | 'clone';
  sourceCoPrecio?: string;
  onConfirm: (body: NewListBody) => Promise<PriceListDto>;
  onClose: () => void;
}

export default function NewListDialog({ lists, currencies, mode, sourceCoPrecio, onConfirm, onClose }: Props) {
  const today = todayIso();
  const [name, setName] = useState('');
  const [coMone, setCoMone] = useState(currencies.includes('USD') ? 'USD' : currencies[0] ?? '');
  const [source, setSource] = useState<string | null>(sourceCoPrecio ?? null);
  const [percentText, setPercentText] = useState('');
  const [from, setFrom] = useState(today);

  const options = useMemo(() => lists.map(l => ({ value: l.coPrecio, label: `${l.coPrecio} · ${l.desPrecio}` })), [lists]);
  const trimmed = name.trim();
  const pctBlank = percentText.trim() === '';
  const percent = pctBlank ? null : parsePercentInput(percentText);
  const percentOk = pctBlank || (percent !== null && percent > -100 && percent <= 1000);
  const dateOk = isValidIsoDate(from) && from >= today;
  const valid = trimmed.length > 0 && trimmed.length <= 60 && (mode === 'create' ? coMone !== '' : source !== null && percentOk && dateOk);

  const { submitting, error, run } = useSubmit(async () => {
    if (mode === 'create') await onConfirm({ mode: 'create', desPrecio: trimmed, coMone });
    else if (source) await onConfirm({ mode: 'clone', sourceCoPrecio: source, desPrecio: trimmed, percent, effectiveFrom: from });
  });

  return (
    <Modal title={mode === 'create' ? 'Nueva lista de precios' : 'Clonar lista de precios'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        {mode === 'clone' && (
          <div className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            <span>Lista de origen</span>
            <SearchableSelect value={source} onChange={setSource} options={options} placeholder="Buscar lista" ariaLabel="Lista de origen" />
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre
          <input type="text" value={name} maxLength={60} onChange={e => setName(e.target.value)} className={INPUT} autoFocus />
        </label>
        {mode === 'create' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Moneda
            <select value={coMone} onChange={e => setCoMone(e.target.value)} className={INPUT}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              Ajuste % (opcional)
              <input type="text" inputMode="decimal" placeholder="-10 o 5,5" value={percentText}
                aria-invalid={!percentOk || undefined} onChange={e => setPercentText(e.target.value)} className={INPUT} />
              {!percentOk && <span className="font-normal text-red-700">Porcentaje inválido</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              Vigente desde
              <input type="date" value={from} min={today} onChange={e => setFrom(e.target.value)} className={INPUT} />
            </label>
          </>
        )}
        {error && <ErrorBox>{error.message}</ErrorBox>}
        <DialogFooter onClose={onClose} confirmLabel={mode === 'create' ? 'Crear lista' : 'Clonar lista'} disabled={!valid} submitting={submitting} />
      </form>
    </Modal>
  );
}
