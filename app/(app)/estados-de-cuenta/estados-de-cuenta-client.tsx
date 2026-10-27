'use client';

import { useEffect, useMemo, useState } from 'react';
import posthog from 'posthog-js';
import SearchableSelect from '@/lib/components/searchable-select';

interface CustomerOption { co_cli: string; cli_des: string }

export function EstadosDeCuentaClient() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/statements/customers');
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Error al cargar clientes');
        if (!cancelled) setCustomers(body.customers);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar clientes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(
    () => customers.map(c => ({ value: c.co_cli, label: `${c.co_cli} - ${c.cli_des}` })),
    [customers],
  );

  function handleDownload() {
    if (selected) posthog.capture('statement_download_clicked', { co_cli: selected });
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold mb-4">Estados de cuenta</h1>
      {loading && <p className="text-sm text-gray-500">Cargando clientes...</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="space-y-3">
          <SearchableSelect
            value={selected}
            onChange={setSelected}
            options={options}
            placeholder="Buscar cliente..."
            ariaLabel="Cliente"
          />
          {selected ? (
            <a
              href={`/api/statements/${encodeURIComponent(selected)}`}
              download
              onClick={handleDownload}
              className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white"
            >
              Descargar PDF
            </a>
          ) : (
            <button type="button" disabled className="rounded bg-blue-600 px-4 py-2 text-sm text-white opacity-50">
              Descargar PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}
