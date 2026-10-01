'use client';

export interface LayerState { pins: boolean; areas: boolean; choropleth: boolean; density: boolean }

const LABELS: [keyof LayerState, string][] = [
  ['pins', 'Clientes (pines)'],
  ['areas', 'Zonas'],
  ['choropleth', 'Ingresos por zona'],
  ['density', 'Densidad de ingresos'],
];

export function LayerToggles({ layers, onChange }: { layers: LayerState; onChange: (l: LayerState) => void }) {
  return (
    <fieldset className="space-y-1 p-4 pt-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Capas</legend>
      {LABELS.map(([key, label]) => (
        <label key={key} className="flex min-h-11 items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={layers[key]}
            onChange={e => onChange({ ...layers, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
