// app/(app)/mapa/components/routes-panel.tsx
'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import SearchableSelect from '@/lib/components/searchable-select';
import type { MapCustomer, MapSeller, RouteDto } from '@/lib/geo/types';

interface Props {
  routes: RouteDto[];
  sellers: MapSeller[];
  customers: MapCustomer[];
  sellerFilter: string | null;
  onRoutesChanged: (next: RouteDto[]) => void;
  onShowRoute: (routeId: number) => void;
}

const btn = 'min-h-11 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: { error?: string; item?: RouteDto } | null }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, json: await res.json().catch(() => null) };
}

export function RoutesPanel({ routes, sellers, customers, sellerFilter, onRoutesChanged, onShowRoute }: Props) {
  const [name, setName] = useState('');
  const [sellerCode, setSellerCode] = useState<string | null>(sellerFilter);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RouteDto | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<RouteDto | null>(null);

  const shown = sellerFilter ? routes.filter(r => r.sellerCode === sellerFilter) : routes;
  const sellerName = (code: string) => sellers.find(s => s.code === code)?.name ?? code;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const seller = sellerCode ?? sellerFilter;
    if (!seller) { setError('Seleccione un vendedor'); return; }
    const { ok, json } = await call('/api/mapa/rutas', 'POST', { name, sellerCode: seller });
    if (!ok) { setError(json?.error ?? 'Error al crear la ruta'); return; }
    setError(null); setName('');
    if (json?.item) onRoutesChanged([...routes, json.item]);
  }

  function openEditor(route: RouteDto) {
    setEditing(route); setSelection(new Set(route.customerCodes)); setQuery('');
  }

  async function saveMembers() {
    if (!editing) return;
    const { ok, json } = await call(`/api/mapa/rutas/${editing.id}`, 'PATCH', { customerCodes: [...selection] });
    if (!ok) { setError(json?.error ?? 'Error al guardar la ruta'); return; }
    setError(null);
    const item = json?.item;
    if (item) onRoutesChanged(routes.map(r => (r.id === editing.id ? item : r)));
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { ok, json } = await call(`/api/mapa/rutas/${deleting.id}`, 'DELETE');
    if (!ok) { setError(json?.error ?? 'Error al eliminar la ruta'); setDeleting(null); return; }
    onRoutesChanged(routes.filter(r => r.id !== deleting.id));
    setDeleting(null);
  }

  // Customers of the route's seller first; the checklist can still add anyone.
  const candidates = useMemo(() => {
    if (!editing) return [];
    const q = query.trim().toLowerCase();
    return customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.coCli.toLowerCase().includes(q))
      .sort((a, b) => Number(b.coVen === editing.sellerCode) - Number(a.coVen === editing.sellerCode) || a.name.localeCompare(b.name, 'es'));
  }, [customers, editing, query]);

  return (
    <section aria-label="Rutas" className="space-y-4 p-4">
      <form onSubmit={create} className="space-y-2">
        <label htmlFor="route-name" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nueva ruta</label>
        <input id="route-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Ruta Lunes Norte"
          className="min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
        <SearchableSelect
          value={sellerCode ?? sellerFilter}
          onChange={setSellerCode}
          options={sellers.map(s => ({ value: s.code, label: s.name }))}
          placeholder="Vendedor…"
          allLabel="Seleccione vendedor"
        />
        <button type="submit" className={`${btn} w-full border-blue-600 bg-blue-600 font-medium text-white hover:bg-blue-700`}>Crear ruta</button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {shown.length === 0 ? <p className="text-sm text-gray-500">No hay rutas{sellerFilter ? ' para este vendedor' : ''}.</p> : (
        <ul className="divide-y divide-gray-100" aria-label="Rutas existentes">
          {shown.map(r => (
            <li key={r.id} className="space-y-2 py-3">
              <p className="text-sm font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500">{sellerName(r.sellerCode)} · {r.customerCodes.length} clientes</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => onShowRoute(r.id)}>Ver en mapa</button>
                <button type="button" className={`${btn} border-gray-300 hover:bg-gray-50`} onClick={() => openEditor(r)}>Clientes</button>
                <button type="button" className={`${btn} border-red-300 text-red-700 hover:bg-red-50`} onClick={() => setDeleting(r)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={`Clientes de ${editing.name}`} onClose={() => setEditing(null)}>
          <input aria-label="Buscar cliente" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente…"
            className="mb-3 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
          <ul className="max-h-72 divide-y divide-gray-100 overflow-auto" aria-label="Clientes">
            {candidates.map(c => (
              <li key={c.coCli}>
                <label className="flex min-h-11 items-center gap-3 text-sm text-gray-800">
                  <input type="checkbox" className="h-4 w-4" checked={selection.has(c.coCli)}
                    onChange={e => setSelection(s => { const n = new Set(s); if (e.target.checked) n.add(c.coCli); else n.delete(c.coCli); return n; })} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.sellerName ?? c.coVen}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-blue-600 bg-blue-600 font-medium text-white`} onClick={saveMembers}>Guardar ({selection.size})</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Eliminar ruta" onClose={() => setDeleting(null)}>
          <p className="text-sm text-gray-700">¿Eliminar la ruta «{deleting.name}»? Los clientes no se eliminan.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={`${btn} border-gray-300`} onClick={() => setDeleting(null)}>Cancelar</button>
            <button type="button" className={`${btn} border-red-600 bg-red-600 font-medium text-white`} onClick={confirmDelete}>Eliminar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
