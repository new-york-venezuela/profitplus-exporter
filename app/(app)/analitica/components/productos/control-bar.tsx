'use client';

import { useEffect, useRef, useState } from 'react';
import SearchableSelect, { type SearchableSelectOption } from '@/lib/components/searchable-select';
import MultiSelect, { type MultiSelectOption } from '@/lib/components/multi-select';
import type { Metric, Nivel, ProductosParams } from '../../lib/productos-params';

export interface ControlBarProps {
  params: ProductosParams;
  onChange: (patch: Partial<ProductosParams>) => void;
  tiendas: SearchableSelectOption[];
  categorias: string[];
  lineaOptions: MultiSelectOption[];
  sublineaOptions: MultiSelectOption[];
  grupoOptions: MultiSelectOption[];
}

const NIVELES: { value: Nivel; label: string }[] = [
  { value: 'linea', label: 'Línea' },
  { value: 'sublinea', label: 'Sublínea' },
  { value: 'sku', label: 'SKU' },
];
const METRICS: { value: Metric; label: string }[] = [
  { value: 'ventas', label: 'Ventas netas' },
  { value: 'unidades', label: 'Unidades' },
];
const SEARCH_DELAY_MS = 250;

function segClass(active: boolean) {
  return `px-3 py-1 text-sm border border-gray-200 ${active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`;
}

export default function ControlBar({
  params, onChange, tiendas, categorias, lineaOptions, sublineaOptions, grupoOptions,
}: ControlBarProps) {
  const [q, setQ] = useState(params.q);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmitted = useRef(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes from elsewhere.
  useEffect(() => { setQ(params.q); lastEmitted.current = params.q; }, [params.q]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleSearch(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v !== lastEmitted.current) {
        lastEmitted.current = v;
        onChangeRef.current({ q: v });
      }
    }, SEARCH_DELAY_MS);
  }

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 py-2 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Nivel" className="inline-flex rounded overflow-hidden">
        {NIVELES.map(n => (
          <button key={n.value} type="button" aria-pressed={params.nivel === n.value}
            onClick={() => onChange({ nivel: n.value })} className={segClass(params.nivel === n.value)}>
            {n.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Métrica" className="inline-flex rounded overflow-hidden">
        {METRICS.map(m => (
          <button key={m.value} type="button" aria-pressed={params.metric === m.value}
            onClick={() => onChange({ metric: m.value })} className={segClass(params.metric === m.value)}>
            {m.label}
          </button>
        ))}
      </div>
      <SearchableSelect
        value={params.tienda} onChange={v => onChange({ tienda: v })} options={tiendas}
        allLabel="Todas" placeholder="Todas las tiendas" ariaLabel="Tienda" className="w-48"
      />
      <select
        aria-label="Categoría" value={params.categoria ?? ''}
        onChange={e => onChange({ categoria: e.target.value || null })}
        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
      >
        <option value="">Todas las categorías</option>
        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <MultiSelect options={lineaOptions} value={params.lineas} onChange={v => onChange({ lineas: v })}
        placeholder="Líneas" ariaLabel="Líneas" />
      <MultiSelect options={sublineaOptions} value={params.sublineas} onChange={v => onChange({ sublineas: v })}
        placeholder="Sublíneas" ariaLabel="Sublíneas" />
      <select
        aria-label="Grupo de clientes" value={params.grupo ?? ''}
        onChange={e => onChange({ grupo: e.target.value || null })}
        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
      >
        <option value="">Todos los grupos</option>
        {grupoOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <input
        type="search" value={q} onChange={e => handleSearch(e.target.value)}
        placeholder="Buscar por código o nombre de SKU..." aria-label="Buscar SKU"
        className="border border-gray-200 rounded px-2 py-1 text-sm w-72"
      />
    </div>
  );
}
