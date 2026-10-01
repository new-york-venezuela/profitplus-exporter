'use client';

import type { MapCustomer } from '@/lib/geo/types';

export interface EditDraft {
  coCli: string;
  lat: string;
  lng: string;
  dirEnt2: string;
  saving: boolean;
  errors: { coordinates?: string; dirEnt2?: string; form?: string };
}

interface Props {
  customer: MapCustomer;
  draft: EditDraft;
  onChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const input = 'min-h-11 w-full rounded-md border bg-white px-3 text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

export function LocationEditor({ customer, draft, onChange, onSave, onCancel }: Props) {
  return (
    <form
      aria-label={`Editar ubicación de ${customer.name}`}
      onSubmit={e => { e.preventDefault(); onSave(); }}
      className="space-y-3 border-b border-blue-200 bg-blue-50 p-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{customer.name}</h2>
        <p className="text-xs text-gray-600">Haga clic en el mapa o arrastre el marcador azul para colocar el punto.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="loc-lat" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Latitud</label>
          <input id="loc-lat" inputMode="decimal" className={`${input} ${draft.errors.coordinates ? 'border-red-500' : 'border-gray-300'}`}
            value={draft.lat} onChange={e => onChange({ lat: e.target.value })} aria-describedby="loc-coord-err" aria-invalid={Boolean(draft.errors.coordinates)} />
        </div>
        <div>
          <label htmlFor="loc-lng" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Longitud</label>
          <input id="loc-lng" inputMode="decimal" className={`${input} ${draft.errors.coordinates ? 'border-red-500' : 'border-gray-300'}`}
            value={draft.lng} onChange={e => onChange({ lng: e.target.value })} aria-describedby="loc-coord-err" aria-invalid={Boolean(draft.errors.coordinates)} />
        </div>
      </div>
      <p id="loc-coord-err" role={draft.errors.coordinates ? 'alert' : undefined} className="text-xs text-red-700">{draft.errors.coordinates}</p>

      <div>
        <label htmlFor="loc-dir" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Dirección de entrega</label>
        <textarea id="loc-dir" rows={3} className={`${input} py-2 ${draft.errors.dirEnt2 ? 'border-red-500' : 'border-gray-300'}`}
          value={draft.dirEnt2} onChange={e => onChange({ dirEnt2: e.target.value })} aria-describedby="loc-dir-err" aria-invalid={Boolean(draft.errors.dirEnt2)} />
        <p id="loc-dir-err" role={draft.errors.dirEnt2 ? 'alert' : undefined} className="mt-1 text-xs text-red-700">{draft.errors.dirEnt2}</p>
      </div>

      {draft.errors.form && <p role="alert" className="text-sm text-red-700">{draft.errors.form}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={draft.saving}
          className="min-h-11 flex-1 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {draft.saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} disabled={draft.saving}
          className="min-h-11 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          Cancelar
        </button>
      </div>
    </form>
  );
}
