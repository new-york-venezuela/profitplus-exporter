'use client';

import { useEffect, useState } from 'react';
import SearchableSelect from '@/lib/components/searchable-select';
import type { ClientesFiltersResponse } from '../types';

export default function CarteraFilterBar({
  grupo, ruta, onGrupo, onRuta,
}: {
  grupo: string | null;
  ruta: string | null;
  onGrupo: (v: string | null) => void;
  onRuta: (v: string | null) => void;
}) {
  const [options, setOptions] = useState<ClientesFiltersResponse>({ groups: [], routes: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dwh/clientes?section=filters');
        if (cancelled || !res.ok) return;
        const body: ClientesFiltersResponse = await res.json();
        if (!cancelled) setOptions(body);
      } catch {
        // Non-critical: the selects just stay empty.
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-lg p-4 print:hidden">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Grupo y ruta</h2>
        <p className="text-xs text-gray-500 max-w-xl">
          Filtran toda la pestaña por el grupo y la ruta actuales del cliente. En Entidad, las devoluciones se atribuyen a la entidad completa.
        </p>
      </div>
      <div className="w-56">
        <SearchableSelect
          value={grupo}
          onChange={onGrupo}
          options={options.groups}
          allLabel="Todos los grupos"
          placeholder="Grupo…"
          ariaLabel="Filtrar por grupo"
        />
      </div>
      <div className="w-44">
        <SearchableSelect
          value={ruta}
          onChange={onRuta}
          options={options.routes}
          allLabel="Todas las rutas"
          placeholder="Ruta…"
          ariaLabel="Filtrar por ruta"
        />
      </div>
    </div>
  );
}
