'use client';

import { useMemo, useState } from 'react';
import type { HistCatalogoResponse, HistProductosFiltrosResponse, HistTabProps } from '../types';
import MasterTable from '../../analitica/components/productos/master-table';
import { SectionTitle } from '../../analitica/components/resumen/stat-card';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import type { Metric, Nivel } from '../../analitica/lib/productos-params';
import MultiSelect from '@/lib/components/multi-select';
import { useHistFetch } from '../lib/use-hist-fetch';

const NIVELES: { value: Nivel; label: string }[] = [
  { value: 'linea', label: 'Línea' },
  { value: 'sublinea', label: 'Sublínea' },
  { value: 'sku', label: 'SKU' },
];
const METRICS: { value: Metric; label: string }[] = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'unidades', label: 'Unidades' },
];

function Pills<T extends string>({ items, value, onChange, label }: {
  items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1" role="group" aria-label={label}>
      {items.map(i => (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          aria-pressed={value === i.value}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            value === i.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// Productos master table over the legacy data: the current Productos table component with
// the legacy catalogo. No tienda filter, customer-group matrix or customer accordion (legacy
// customers have no current group); "Alcance" = casa matriz clients and stores.
export default function TabProductos({ dateRange, currency, returnsBasis }: HistTabProps) {
  const [nivel, setNivel] = useState<Nivel>('linea');
  const [metric, setMetric] = useState<Metric>('ventas');
  const [categoria, setCategoria] = useState('');
  const [lineas, setLineas] = useState<string[]>([]);
  const [sublineas, setSublineas] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const filtros = useHistFetch<HistProductosFiltrosResponse>('/api/dwh/analitica-historica/productos?section=filtros');

  const catalogoUrl = useMemo(() => {
    const params = [
      'section=catalogo', `dateRange=${dateRange}`, `returnsBasis=${returnsBasis}`, `nivel=${nivel}`, `currency=${currency}`,
    ];
    if (categoria) params.push(`categoria=${encodeURIComponent(categoria)}`);
    if (lineas.length > 0) params.push(`lineas=${encodeURIComponent(lineas.join(','))}`);
    if (sublineas.length > 0) params.push(`sublineas=${encodeURIComponent(sublineas.join(','))}`);
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    return `/api/dwh/analitica-historica/productos?${params.join('&')}`;
  }, [dateRange, returnsBasis, nivel, currency, categoria, lineas, sublineas, q]);
  const { data, loading, error } = useHistFetch<HistCatalogoResponse>(catalogoUrl);

  const lineaOptions = (filtros.data?.lineas ?? []).map(l => ({ value: l, label: l }));
  const sublineaOptions = (filtros.data?.sublineas ?? [])
    .filter(s => lineas.length === 0 || lineas.includes(s.linea))
    .map(s => ({ value: s.sublinea, label: `${s.linea} › ${s.sublinea}` }));

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA. Alcance = clientes (casa matriz) y tiendas.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <SectionTitle>Productos</SectionTitle>
        <Pills items={NIVELES} value={nivel} onChange={setNivel} label="Nivel" />
        <Pills items={METRICS} value={metric} onChange={setMetric} label="Métrica" />
        {(filtros.data?.categorias.length ?? 0) > 0 && (
          <select
            aria-label="Categoría"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          >
            <option value="">Todas las categorías</option>
            {filtros.data!.categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <MultiSelect options={lineaOptions} value={lineas} onChange={setLineas} placeholder="Líneas" ariaLabel="Filtrar por línea" />
        <MultiSelect options={sublineaOptions} value={sublineas} onChange={setSublineas} placeholder="Sublíneas" ariaLabel="Filtrar por sublínea" />
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setQ(search.trim()); }}
            placeholder="Código o nombre"
            aria-label="Buscar producto"
            className="border border-gray-200 rounded px-2 py-1 text-sm w-48"
          />
          <button
            type="button"
            onClick={() => setQ(search.trim())}
            className="px-3 py-1 text-sm font-medium rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Buscar
          </button>
        </div>
      </div>
      <MasterTable
        rows={data?.rows ?? []}
        currency={currency}
        metric={metric}
        nivel={nivel}
        loading={loading && !data}
        error={error}
      />
    </div>
  );
}
