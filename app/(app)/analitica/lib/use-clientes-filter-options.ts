'use client';

import { useEffect, useState } from 'react';
import type { ClientesFiltersResponse } from '../types';

const EMPTY: ClientesFiltersResponse = { groups: [], routes: [] };

// Grupo and ruta options for the Clientes scope bar. Non-critical: a failed request leaves the selects empty.
export function useClientesFilterOptions(): ClientesFiltersResponse {
  const [options, setOptions] = useState<ClientesFiltersResponse>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dwh/clientes?section=filters');
        if (cancelled || !res.ok) return;
        const body: ClientesFiltersResponse = await res.json();
        if (!cancelled) setOptions(body);
      } catch {
        // selects stay empty
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  return options;
}
