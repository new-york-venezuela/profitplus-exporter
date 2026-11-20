'use client';

import SearchableSelect from '@/lib/components/searchable-select';
import { activeFilterCount, type ClientesParams, type Dim, type Origen } from '../../lib/clientes-params';
import { useClientesFilterOptions } from '../../lib/use-clientes-filter-options';
import { SegmentedControl } from './segmented-control';

const DIM_OPTIONS: { value: Dim; label: string }[] = [
  { value: 'entidad', label: 'Casa matriz' },
  { value: 'tienda', label: 'Tienda' },
];
const ORIGEN_OPTIONS: { value: Origen; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'patrimonio', label: 'Patrimonio' },
  { value: 'nuevo', label: 'Nuevos' },
];

function Scope({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {children}
      <div className="text-xs text-gray-600">{note}</div>
    </div>
  );
}

// Tab-level scope: nivel (casa matriz | tienda), grupo, ruta and origen, all in the URL. Period, currency and
// granularity live in the global analytics header. Each control says what it scopes.
export function ScopeBar({ params, onChange, referenceYear }: {
  params: ClientesParams;
  onChange: (patch: Partial<ClientesParams>) => void;
  referenceYear: number;
}) {
  const options = useClientesFilterOptions();
  const active = activeFilterCount(params);
  return (
    <div className="sticky top-0 z-10 bg-white border border-gray-300 rounded-lg shadow-sm p-4 flex items-start gap-6 flex-wrap print:hidden">
      <Scope label="Nivel" note="afecta: tablas y gráficos por cliente">
        <SegmentedControl ariaLabel="Nivel de análisis" value={params.dim} options={DIM_OPTIONS} onChange={dim => onChange({ dim })} />
      </Scope>
      <Scope label="Grupo" note="afecta: todo">
        <div className="w-56">
          <SearchableSelect
            value={params.grupo}
            onChange={grupo => onChange({ grupo })}
            options={options.groups}
            allLabel="Todos los grupos"
            placeholder="Grupo…"
            ariaLabel="Filtrar por grupo"
          />
        </div>
      </Scope>
      <Scope label="Ruta" note="afecta: todo">
        <div className="w-44">
          <SearchableSelect
            value={params.ruta}
            onChange={ruta => onChange({ ruta })}
            options={options.routes}
            allLabel="Todas las rutas"
            placeholder="Ruta…"
            ariaLabel="Filtrar por ruta"
          />
        </div>
      </Scope>
      <Scope label="Origen" note={`Año de referencia: ${referenceYear} · afecta: todo salvo SKUs en caída`}>
        <SegmentedControl ariaLabel="Origen del cliente" value={params.origen} options={ORIGEN_OPTIONS} onChange={origen => onChange({ origen })} />
      </Scope>
      {active > 0 && (
        <button
          type="button"
          onClick={() => onChange({ grupo: null, ruta: null, tienda: null, origen: 'todos' })}
          className="self-center px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          Limpiar filtros ({active})
        </button>
      )}
    </div>
  );
}
