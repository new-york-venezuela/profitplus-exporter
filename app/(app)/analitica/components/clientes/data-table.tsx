'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { downloadCsv, type CsvRecord } from '../../lib/clientes-export';

export interface Column<Row> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortValue?: (r: Row) => string | number | null;
  render: (r: Row) => ReactNode;
  title?: string;
}

interface Props<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (r: Row) => string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  searchText?: (r: Row) => string;
  exportFile?: { name: string; toRecord: (r: Row) => CsvRecord };
  emptyMessage: string;
  renderExpanded?: (r: Row) => ReactNode;
  isExpandable?: (r: Row) => boolean;
  pageSize?: number;
}

function compare(a: string | number | null, b: string | number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const c = typeof a === 'string' || typeof b === 'string' ? String(a).localeCompare(String(b)) : a - b;
  return dir === 'asc' ? c : -c;
}

// Shared table for the Clientes tab: sort buttons with aria-sort (nulls last), optional search, CSV export,
// expandable rows, sticky header inside a horizontal scroll wrapper and optional "show more" paging.
export function DataTable<Row>({
  columns, rows, rowKey, defaultSort, searchText, exportFile, emptyMessage, renderExpanded, isExpandable, pageSize,
}: Props<Row>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(pageSize ?? Infinity);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q && searchText ? rows.filter(r => searchText(r).toLowerCase().includes(q)) : [...rows];
    const col = sort ? columns.find(c => c.key === sort.key) : undefined;
    if (sort && col?.sortValue) {
      const sv = col.sortValue;
      out = out.sort((a, b) => compare(sv(a), sv(b), sort.dir));
    }
    return out;
  }, [rows, query, searchText, sort, columns]);

  function toggleSort(key: string) {
    setSort(prev => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  function toggleOpen(k: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  const expandable = isExpandable !== undefined && renderExpanded !== undefined;
  const slice = visible.slice(0, shown);

  return (
    <div className="space-y-2">
      {(searchText || exportFile) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {searchText ? (
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-64"
            />
          ) : <span />}
          {exportFile && (
            <button
              type="button"
              onClick={() => downloadCsv(exportFile.name, visible.map(exportFile.toRecord))}
              className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              Exportar CSV
            </button>
          )}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="bg-white border border-gray-300 rounded-lg p-6 text-center text-sm text-gray-600">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white z-[1]">
              <tr className="border-b border-gray-200">
                {expandable && <th className="w-8" aria-hidden="true" />}
                {columns.map(col => (
                  <th
                    key={col.key}
                    title={col.title}
                    aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.sortValue ? (
                      <button type="button" onClick={() => toggleSort(col.key)} className="uppercase hover:text-gray-900">
                        {col.label}{sort?.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slice.map(r => {
                const k = rowKey(r);
                const canExpand = expandable && isExpandable(r);
                const isOpen = open.has(k);
                return (
                  <Fragment key={k}>
                    <tr>
                      {expandable && (
                        <td className="px-1">
                          {canExpand && (
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={isOpen ? 'Contraer' : 'Expandir'}
                              onClick={() => toggleOpen(k)}
                              className="px-1 text-gray-700"
                            >
                              {isOpen ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                      )}
                      {columns.map(col => (
                        <td key={col.key} className={`px-3 py-2 text-gray-800 ${col.align === 'right' ? 'text-right' : ''}`}>{col.render(r)}</td>
                      ))}
                    </tr>
                    {canExpand && isOpen && (
                      <tr><td colSpan={columns.length + 1} className="bg-gray-50 px-3 py-2">{renderExpanded(r)}</td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visible.length > slice.length && (
        <button type="button" onClick={() => setShown(s => s + (pageSize ?? 100))} className="text-sm text-blue-700 hover:underline">
          Mostrar más ({visible.length - slice.length} restantes)
        </button>
      )}
    </div>
  );
}
