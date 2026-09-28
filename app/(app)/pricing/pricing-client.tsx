'use client';

import { useEffect, useState } from 'react';

interface PriceListRow {
  coPrecio: string;
  desPrecio: string;
  assignedCustomerCount: number;
}

interface CustomerRow {
  coCli: string;
  cliDes: string;
  coSeg: string | null;
  tipCli: string | null;
  coPrecio: string | null;
  desPrecio: string | null;
}

type AssignmentOutcome = { coCli: string; outcome: 'success' | 'conflict' | 'error'; message?: string };

export default function PricingClient({ canEdit }: { canEdit: boolean }) {
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCoPrecio, setTargetCoPrecio] = useState('');
  const [applying, setApplying] = useState(false);
  const [lastResults, setLastResults] = useState<AssignmentOutcome[] | null>(null);

  useEffect(() => {
    fetch('/api/pricing/price-lists').then(r => r.json()).then(d => setPriceLists(d.priceLists ?? []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (segmentFilter) params.set('segment', segmentFilter);
    fetch(`/api/pricing/customers?${params.toString()}`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []));
  }, [search, segmentFilter]);

  function toggleSelected(coCli: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(coCli)) next.delete(coCli); else next.add(coCli);
      return next;
    });
  }

  async function applyAssignment() {
    if (selected.size === 0 || !targetCoPrecio) return;
    setApplying(true);
    setLastResults(null);
    try {
      const res = await fetch('/api/pricing/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerCodes: [...selected], targetCoPrecio }),
      });
      const data = await res.json();
      setLastResults(data.results ?? []);
      // Refresh the customer list so successful reassignments show their new price list immediately.
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (segmentFilter) params.set('segment', segmentFilter);
      const refreshed = await fetch(`/api/pricing/customers?${params.toString()}`).then(r => r.json());
      setCustomers(refreshed.customers ?? []);
      setSelected(new Set());
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Listas de Precio y Clientes</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Listas de Precio</h2>
          <ul className="space-y-2">
            {priceLists.map(pl => (
              <li key={pl.coPrecio} className="flex justify-between text-sm">
                <span>{pl.desPrecio}</span>
                <span className="text-gray-500">{pl.assignedCustomerCount} clientes</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Clientes</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar por nombre, código o RIF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm flex-1"
            />
            <input
              type="text"
              placeholder="Segmento"
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm w-32"
            />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                {canEdit && <th className="w-8"></th>}
                <th>Cliente</th>
                <th>Segmento</th>
                <th>Lista de Precio Actual</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.coCli} className="border-t border-gray-100">
                  {canEdit && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.coCli)}
                        onChange={() => toggleSelected(c.coCli)}
                      />
                    </td>
                  )}
                  <td className="py-1">{c.cliDes}</td>
                  <td>{c.coSeg ?? '—'}</td>
                  <td>{c.desPrecio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && (
            <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-600">{selected.size} seleccionados</span>
              <select
                value={targetCoPrecio}
                onChange={e => setTargetCoPrecio(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm"
              >
                <option value="">Asignar a lista...</option>
                {priceLists.map(pl => (
                  <option key={pl.coPrecio} value={pl.coPrecio}>{pl.desPrecio}</option>
                ))}
              </select>
              <button
                onClick={applyAssignment}
                disabled={selected.size === 0 || !targetCoPrecio || applying}
                className="bg-blue-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
              >
                {applying ? 'Aplicando...' : 'Asignar'}
              </button>
            </div>
          )}

          {lastResults && (
            <div className="mt-3 text-sm space-y-1">
              {lastResults.map(r => (
                <div key={r.coCli} className={r.outcome === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {r.coCli}: {r.outcome === 'success' ? 'Asignado' : r.outcome === 'conflict' ? 'Conflicto: el cliente fue modificado, recargue e intente de nuevo' : (r.message ?? 'Error')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
