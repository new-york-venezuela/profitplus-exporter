'use client';

import { Fragment, useState } from 'react';
import type { PivotDimension, BreakdownRow } from '../types';

export interface DrilldownColumn<TRow> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format: (row: TRow) => string;
  /** Optional tooltip text shown on hover over the column header (e.g. to clarify a confusing metric). */
  title?: string;
}

export interface GroupedDrilldownTableProps<TRow extends { label: string; value: string }> {
  rows: TRow[];
  columns: DrilldownColumn<TRow>[];
  groupByOptions: { value: PivotDimension; label: string }[];
  groupBy: PivotDimension;
  onGroupByChange: (next: PivotDimension) => void;
  breakdownByOptions?: { value: PivotDimension; label: string }[];
  breakdownBy?: PivotDimension | null;
  onBreakdownByChange?: (next: PivotDimension | null) => void;
  onFetchBreakdown?: (parentValue: string, breakdownBy: PivotDimension) => Promise<BreakdownRow[]>;
  /**
   * Formats a breakdown row's metric value for display (e.g. applies the
   * caller's current currency/exchange-rate selection to a money metric).
   * Defaults to locale-formatted numbers / raw strings when omitted, which
   * does NOT apply currency conversion — callers whose breakdown metrics are
   * money amounts should pass this to stay consistent with the parent row's
   * own currency-aware formatting.
   */
  formatBreakdownMetric?: (metricKey: string, value: string | number | null) => string;
}

export default function GroupedDrilldownTable<TRow extends { label: string; value: string }>({
  rows,
  columns,
  groupByOptions,
  groupBy,
  onGroupByChange,
  breakdownByOptions,
  breakdownBy,
  onBreakdownByChange,
  onFetchBreakdown,
  formatBreakdownMetric,
}: GroupedDrilldownTableProps<TRow>) {
  const [expandedValue, setExpandedValue] = useState<string | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  async function handleToggleExpand(value: string) {
    if (expandedValue === value) {
      setExpandedValue(null);
      return;
    }
    setExpandedValue(value);
    setBreakdownRows([]);
    if (!breakdownBy || !onFetchBreakdown) return;
    setBreakdownLoading(true);
    try {
      const result = await onFetchBreakdown(value, breakdownBy);
      setBreakdownRows(result);
    } finally {
      setBreakdownLoading(false);
    }
  }

  const canExpand = Boolean(breakdownBy && onFetchBreakdown);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Agrupar por:
          <select
            value={groupBy}
            onChange={e => onGroupByChange(e.target.value as PivotDimension)}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          >
            {groupByOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {breakdownByOptions && onBreakdownByChange && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Desglosar por:
            <select
              value={breakdownBy ?? ''}
              onChange={e => onBreakdownByChange(e.target.value ? (e.target.value as PivotDimension) : null)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              <option value="">Sin desglose</option>
              {breakdownByOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {canExpand && <th className="w-8" />}
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  title={col.title}
                  className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${col.align === 'left' ? 'text-left' : 'text-right'} ${col.title ? 'cursor-help' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canExpand ? 2 : 1)} className="px-3 py-6 text-center text-gray-400">
                  Sin datos disponibles todavía.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <Fragment key={row.value}>
                  <tr className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    {canExpand && (
                      <td className="px-2 text-center">
                        <button
                          onClick={() => handleToggleExpand(row.value)}
                          className="text-gray-400 hover:text-blue-600"
                          aria-label={expandedValue === row.value ? 'Contraer' : 'Expandir'}
                        >
                          {expandedValue === row.value ? '▾' : '▸'}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-2 text-gray-800">{row.label}</td>
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 ${col.align === 'left' ? 'text-left text-gray-600' : 'text-right font-medium text-gray-900'}`}
                      >
                        {col.format(row)}
                      </td>
                    ))}
                  </tr>
                  {expandedValue === row.value && canExpand && (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-3 py-2 bg-gray-50/50">
                        {breakdownLoading ? (
                          <div className="text-xs text-gray-400 py-2">Cargando desglose…</div>
                        ) : breakdownRows.length === 0 ? (
                          <div className="text-xs text-gray-400 py-2">Sin desglose disponible.</div>
                        ) : (
                          <table className="min-w-full text-xs ml-6">
                            <tbody className="divide-y divide-gray-100">
                              {breakdownRows.map(br => (
                                <tr key={br.value}>
                                  <td className="px-3 py-1.5 text-gray-600">{br.label}</td>
                                  {Object.keys(br)
                                    .filter(k => k !== 'label' && k !== 'value')
                                    .map(metricKey => (
                                      <td key={metricKey} className="px-3 py-1.5 text-right text-gray-800">
                                        {formatBreakdownMetric
                                          ? formatBreakdownMetric(metricKey, br[metricKey])
                                          : typeof br[metricKey] === 'number'
                                            ? (br[metricKey] as number).toLocaleString('es-VE')
                                            : String(br[metricKey] ?? '—')}
                                      </td>
                                    ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
