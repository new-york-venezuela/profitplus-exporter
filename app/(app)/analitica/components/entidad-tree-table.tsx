'use client';

import { Fragment, useState, type ReactNode } from 'react';
import type { VentasRow } from '../types';
import type { DrilldownColumn } from './grouped-drilldown-table';

export type TreeChildRequest =
  | { level: 'tienda'; entityKey: string }
  | { level: 'producto'; entityKey: string; storeCode: string };

interface TreeNode {
  status: 'loading' | 'ready' | 'error';
  rows: VentasRow[];
}

type Row = VentasRow & { label: string; value: string };

interface Props {
  rows: Row[];
  columns: DrilldownColumn<Row>[];
  fetchChildren: (req: TreeChildRequest) => Promise<VentasRow[]>;
}

// Entidad → tiendas → productos. Every Entidad can be opened (even one with a
// single store, so the interaction is uniform); each tienda opens to its
// productos. Children use the exact same columns as the top level, so figures
// add up visibly. Nodes load lazily and are cached per parent; mount the
// component with a `key` that changes when the filters do, which resets it.
export default function EntidadTreeTable({ rows, columns, fetchChildren }: Props) {
  const [nodes, setNodes] = useState<Record<string, TreeNode>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function load(nodeKey: string, req: TreeChildRequest) {
    setNodes(prev => ({ ...prev, [nodeKey]: { status: 'loading', rows: [] } }));
    try {
      const result = await fetchChildren(req);
      setNodes(prev => ({ ...prev, [nodeKey]: { status: 'ready', rows: result } }));
    } catch {
      setNodes(prev => ({ ...prev, [nodeKey]: { status: 'error', rows: [] } }));
    }
  }

  function toggle(nodeKey: string, req: TreeChildRequest) {
    const nextOpen = !open[nodeKey];
    setOpen(prev => ({ ...prev, [nodeKey]: nextOpen }));
    if (nextOpen && !nodes[nodeKey]) void load(nodeKey, req);
  }

  const colSpan = columns.length + 2;

  function cells(row: Row): ReactNode {
    return columns.map(col => (
      <td
        key={col.key}
        className={`px-3 py-2 ${col.align === 'left' ? 'text-left text-gray-600' : 'text-right font-medium text-gray-900'}`}
      >
        {col.format(row)}
      </td>
    ));
  }

  function expander(nodeKey: string, req: TreeChildRequest, openLabel: string, closeLabel: string) {
    return (
      <td className="px-2 text-center w-8">
        <button
          type="button"
          onClick={() => toggle(nodeKey, req)}
          className="text-gray-400 hover:text-blue-600"
          aria-label={open[nodeKey] ? closeLabel : openLabel}
          aria-expanded={Boolean(open[nodeKey])}
        >
          {open[nodeKey] ? '▾' : '▸'}
        </button>
      </td>
    );
  }

  function status(nodeKey: string, req: TreeChildRequest, emptyText: string, loadingText: string) {
    const node = nodes[nodeKey];
    if (!node || node.status === 'loading') {
      return (
        <tr key={`${nodeKey}:s`}><td colSpan={colSpan} className="px-10 py-2 text-xs text-gray-400">{loadingText}</td></tr>
      );
    }
    if (node.status === 'error') {
      return (
        <tr key={`${nodeKey}:s`}>
          <td colSpan={colSpan} className="px-10 py-2 text-xs text-red-600">
            No se pudo cargar el desglose.{' '}
            <button type="button" className="underline" onClick={() => void load(nodeKey, req)}>Reintentar</button>
          </td>
        </tr>
      );
    }
    if (node.rows.length === 0) {
      return (
        <tr key={`${nodeKey}:s`}><td colSpan={colSpan} className="px-10 py-2 text-xs text-gray-400">{emptyText}</td></tr>
      );
    }
    return null;
  }

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-8" />
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Entidad</th>
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
              <td colSpan={colSpan} className="px-3 py-6 text-center text-gray-400">Sin datos disponibles todavía.</td>
            </tr>
          ) : (
            rows.map((entidad, i) => {
              const eKey = `e:${entidad.value}`;
              const eReq: TreeChildRequest = { level: 'tienda', entityKey: entidad.value };
              const tiendas = nodes[eKey];
              return (
                <Fragment key={eKey}>
                  <tr className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                    {expander(eKey, eReq, 'Ver tiendas', 'Ocultar tiendas')}
                    <td className="px-3 py-2 text-gray-800">{entidad.label}</td>
                    {cells(entidad)}
                  </tr>
                  {open[eKey] && status(eKey, eReq, 'Sin tiendas con ventas en el período.', 'Cargando tiendas…')}
                  {open[eKey] && tiendas?.status === 'ready' && tiendas.rows.map(tienda => {
                    const tKey = `t:${entidad.value}:${tienda.value}`;
                    const tReq: TreeChildRequest = { level: 'producto', entityKey: entidad.value, storeCode: String(tienda.value) };
                    const productos = nodes[tKey];
                    const tiendaRow: Row = { ...tienda, label: tienda.label, value: String(tienda.value) };
                    return (
                      <Fragment key={tKey}>
                        <tr className="bg-gray-50">
                          {expander(tKey, tReq, 'Ver productos', 'Ocultar productos')}
                          <td className="py-2 pl-8 pr-3 text-gray-700">
                            {tienda.label}
                            <span className="block text-xs text-gray-400">{tienda.value}</span>
                          </td>
                          {cells(tiendaRow)}
                        </tr>
                        {open[tKey] && status(tKey, tReq, 'Sin productos con ventas en el período.', 'Cargando productos…')}
                        {open[tKey] && productos?.status === 'ready' && productos.rows.map(prod => {
                          const prodRow: Row = { ...prod, label: prod.label, value: String(prod.value) };
                          return (
                            <tr key={`p:${tKey}:${prod.value}`} className="bg-gray-100/60 text-xs">
                              <td />
                              <td className="py-1.5 pl-14 pr-3 text-gray-600">{prod.label}</td>
                              {cells(prodRow)}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
