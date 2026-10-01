'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { AreaStats } from '@/lib/geo/area-match';
import type { Ring } from '@/lib/geo/geometry';
import type { MapSeller } from '@/lib/geo/types';

export interface AreaDraft {
  id: number | null;
  name: string;
  color: string;
  sellerCodes: string[];
  ring: Ring | null;
  phase: 'draw' | 'form' | 'shape';
  saving: boolean;
  error: string | null;
}

interface Props {
  areas: AreaDto[];
  stats: Map<number, AreaStats>;
  sellers: MapSeller[];
  draft: AreaDraft | null;
  onStartDraw: () => void;
  onEditArea: (area: AreaDto) => void;
  onChangeDraft: (patch: Partial<AreaDraft>) => void;
  onEditShape: () => void;
  onDoneShape: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (area: AreaDto) => Promise<string | null>;
}

const usd = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const btn = 'min-h-11 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const field = 'min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function AreasPanel(p: Props) {
  const [deleting, setDeleting] = useState<AreaDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const sellerName = (code: string) => p.sellers.find(s => s.code === code)?.name ?? code;

  return (
    <section aria-label="Zonas" className="space-y-4 p-4">
      {p.draft === null && (
        <button type="button" onClick={p.onStartDraw} className={`${btn} w-full border-blue-600 bg-blue-600 font-medium text-white hover:bg-blue-700`}>
          Dibujar nueva zona
        </button>
      )}

      {p.draft?.phase === 'draw' && (
        <div role="status" className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Dibujando zona</p>
          <p>Haga clic en el mapa para agregar puntos y clic en el primer punto para cerrar. Esc cancela.</p>
          <button type="button" onClick={p.onCancel} className={`${btn} border-blue-600 bg-white text-blue-800`}>Cancelar</button>
        </div>
      )}

      {p.draft?.phase === 'shape' && (
        <div role="status" className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Editando la forma</p>
          <p>Arrastre los puntos para ajustar los bordes. Los bordes no pueden cruzarse.</p>
          <button type="button" onClick={p.onDoneShape} className={`${btn} border-blue-600 bg-blue-600 font-medium text-white`}>Listo</button>
        </div>
      )}

      {p.draft?.phase === 'form' && (
        <form onSubmit={e => { e.preventDefault(); p.onSave(); }} aria-label={p.draft.id === null ? 'Nueva zona' : 'Editar zona'} className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <div>
            <label htmlFor="area-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre</label>
            <input id="area-name" className={field} value={p.draft.name} onChange={e => p.onChangeDraft({ name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="area-color" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Color</label>
            <input id="area-color" type="color" className="h-11 w-16 cursor-pointer rounded-md border border-gray-300" value={p.draft.color} onChange={e => p.onChangeDraft({ color: e.target.value })} />
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Vendedores de la zona</legend>
            <ul className="max-h-40 overflow-auto">
              {p.sellers.map(s => (
                <li key={s.code}>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
                    <input type="checkbox" className="h-4 w-4" checked={p.draft!.sellerCodes.includes(s.code)}
                      onChange={e => p.onChangeDraft({ sellerCodes: e.target.checked ? [...p.draft!.sellerCodes, s.code] : p.draft!.sellerCodes.filter(c => c !== s.code) })} />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {p.draft.error && <p role="alert" className="text-sm text-red-700">{p.draft.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={p.draft.saving} className={`${btn} border-blue-600 bg-blue-600 font-medium text-white disabled:opacity-60`}>{p.draft.saving ? 'Guardando…' : 'Guardar zona'}</button>
            <button type="button" onClick={p.onEditShape} className={`${btn} border-gray-300 bg-white`}>Editar forma</button>
            <button type="button" onClick={p.onCancel} disabled={p.draft.saving} className={`${btn} border-gray-300 bg-white`}>Cancelar</button>
          </div>
        </form>
      )}

      {p.areas.length === 0 ? <p className="text-sm text-gray-500">Aún no hay zonas.</p> : (
        <ul aria-label="Zonas existentes" className="divide-y divide-gray-100">
          {p.areas.map(a => {
            const s = p.stats.get(a.id);
            return (
              <li key={a.id} className="space-y-2 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-gray-400" style={{ background: a.color }} />{a.name}
                </p>
                <p className="text-xs text-gray-500">
                  {a.sellerCodes.length ? a.sellerCodes.map(sellerName).join(', ') : 'Sin vendedores'} · {s?.customers ?? 0} clientes · {usd.format(s?.revenueUsd ?? 0)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => p.onEditArea(a)}>Editar</button>
                  <button type="button" className={`${btn} border-red-300 text-red-700 hover:bg-red-50`} onClick={() => { setDeleteError(null); setDeleting(a); }}>Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <Modal title="Eliminar zona" onClose={() => setDeleting(null)}>
          <p className="text-sm text-gray-700">¿Eliminar la zona «{deleting.name}»? Sus clientes quedarán sin zona.</p>
          {deleteError && <p role="alert" className="mt-2 text-sm text-red-700">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setDeleting(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-red-600 bg-red-600 font-medium text-white`}
              onClick={async () => { const err = await p.onDelete(deleting); if (err) setDeleteError(err); else setDeleting(null); }}>
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
