'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReportConfig, ColumnDef }      from '@/lib/reports/registry';
import type { DateRange }                    from '@/lib/dates';
import { DateRangePicker }                   from './date-range-picker';
import { ColumnManager }                     from './column-manager';

interface PreviewData {
  rows:       Record<string, unknown>[];
  total:      number;
}

interface Props {
  config:       ReportConfig;
  defaultDates: DateRange;
}

/** Returns the initially-visible columns sorted by defaultOrder. */
function initVisibleCols(config: ReportConfig): ColumnDef[] {
  return config.columns
    .filter(c => c.defaultVisible || !!c.alwaysVisible)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export function ReportPage({ config, defaultDates }: Props) {
  const [startDate,   setStartDate]   = useState(defaultDates.startDate);
  const [endDate,     setEndDate]     = useState(defaultDates.endDate);
  const [visibleCols, setVisibleCols] = useState<ColumnDef[]>(() => initVisibleCols(config));
  const [preview,     setPreview]     = useState<PreviewData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [selectors,   setSelectors]   = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    config.selectors?.forEach(s => {
      init[s.key] = s.defaultValue;
    });
    return init;
  });

  const hasColumns    = config.columns.length > 0;
  const colsParam     = visibleCols.map(c => c.key).join(',');

  const fetchPreview = useCallback(
    async (start: string, end: string, cols: string, sels: Record<string, string>) => {
      if (!hasColumns || !cols) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`/api/reports/${config.id}/preview`, window.location.origin);
        url.searchParams.set('startDate', start);
        url.searchParams.set('endDate', end);
        url.searchParams.set('cols', cols);
        Object.entries(sels).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
        const res = await fetch(url.toString());
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
        }
        setPreview(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [config.id, hasColumns],
  );

  // Fetch on mount
  useEffect(() => {
    fetchPreview(startDate, endDate, colsParam, selectors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDateChange(newStart: string, newEnd: string) {
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchPreview(newStart, newEnd, colsParam, selectors);
  }

  function handleColumnsChange(next: ColumnDef[]) {
    setVisibleCols(next);
    fetchPreview(startDate, endDate, next.map(c => c.key).join(','), selectors);
  }

  function handleSelectorChange(key: string, value: string) {
    const newSelectors = { ...selectors, [key]: value };
    setSelectors(newSelectors);
    fetchPreview(startDate, endDate, colsParam, newSelectors);
  }

  function handleExport() {
    const params = new URLSearchParams({
      startDate,
      endDate,
      cols: colsParam,
    });
    Object.entries(selectors).forEach(([key, value]) => {
      params.set(key, value);
    });
    const exportUrl = `/api/reports/${config.id}/export?${params}`;
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{config.label}</h1>
      </div>

      {/* Controls card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-5">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
        />

        {config.selectors && config.selectors.length > 0 && (
          <div className="space-y-3">
            {config.selectors.map(selector => (
              <div key={selector.key}>
                <label htmlFor={selector.key} className="block text-sm font-medium text-gray-700 mb-1">
                  {selector.label}
                </label>
                <select
                  id={selector.key}
                  value={selectors[selector.key] || selector.defaultValue}
                  onChange={(e) => handleSelectorChange(selector.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selector.options.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {hasColumns ? (
          <ColumnManager columns={config.columns} onChange={handleColumnsChange} />
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200
                        rounded px-3 py-2">
            Las columnas de este reporte aún no han sido configuradas.
            Edita <code className="font-mono text-xs">lib/reports/{config.id}.ts</code> para añadirlas.
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleExport}
            disabled={!hasColumns || visibleCols.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700
                       text-white text-sm font-medium rounded-md transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↓ Exportar CSV
          </button>

          {preview && (
            <span className="text-sm text-gray-500">
              {preview.total.toLocaleString('es-VE')} registros
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Cargando…
        </div>
      )}

      {/* Preview table */}
      {!loading && preview && preview.rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {visibleCols.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600
                                 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    {visibleCols.map(col => (
                      <td
                        key={col.key}
                        className="px-4 py-2.5 text-gray-700 whitespace-nowrap"
                      >
                        {row[col.key] == null ? '' : String(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > preview.rows.length && (
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
              Mostrando {preview.rows.length} de {preview.total.toLocaleString('es-VE')} registros.
              Exporta el CSV para obtener todos.
            </p>
          )}
        </div>
      )}

      {!loading && preview && preview.rows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Sin registros para el período seleccionado.
        </div>
      )}
    </div>
  );
}
