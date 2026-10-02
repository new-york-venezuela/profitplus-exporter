'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { MapCustomer, MapSeller } from '@/lib/geo/types';

export function SellerChangeModal({
  customer, sellers, onClose, onSaved,
}: { customer: MapCustomer; sellers: MapSeller[]; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inactive sellers are rejected by the ERP procedure, so they are not offered.
  const options = useMemo(
    () => sellers.filter(s => !s.inactive && s.code !== customer.coVen)
      .map(s => ({ value: s.code, label: s.name === s.code ? s.code : `${s.name} · ${s.code}` })),
    [sellers, customer.coVen],
  );

  async function save() {
    if (!value) { setError('Seleccione un vendedor'); return; }
    setSaving(true); setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/mapa/clientes/${encodeURIComponent(customer.coCli)}/vendedor`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coVen: value }),
      });
    } catch {
      setSaving(false); setError('Error de red al guardar');
      return;
    }
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setSaving(false); setError(json?.error ?? 'Error al guardar');
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Cambiar vendedor" onClose={saving ? () => {} : onClose}>
      <div className="space-y-3 text-sm text-gray-800">
        <p>
          <span className="font-medium">{customer.name}</span>
          <span className="block text-xs text-gray-500">Vendedor actual: {customer.sellerName ?? customer.coVen}</span>
        </p>
        <div>
          <p className="mb-1 font-medium">Nuevo vendedor</p>
          <SearchableSelect
            value={value}
            onChange={v => { setValue(v); setError(null); }}
            options={options}
            placeholder="Buscar vendedor…"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button" onClick={onClose} disabled={saving}
            className="min-h-11 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Cancelar
          </button>
          <button
            type="button" onClick={save} disabled={saving}
            className="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
