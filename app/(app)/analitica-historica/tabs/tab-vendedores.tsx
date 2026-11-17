'use client';

import { useState } from 'react';
import type { HistTabProps, HistVendedoresResponse, HistVendedorStats } from '../types';
import { SectionTitle } from '../../analitica/components/resumen/stat-card';
import { SalesReturnsChart } from '../../analitica/components/resumen/sales-returns-chart';
import { RETURNS_BASIS_LABEL } from '../../analitica/lib/net-sales';
import { periodLabel } from '../../analitica/lib/period-label';
import { HistEmpty, HistError, HistLoading } from '../components/hist-states';
import { histMoney } from '../lib/format';
import { useHistFetch } from '../lib/use-hist-fetch';

const nf = (n: number) => n.toLocaleString('es-VE');
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

const HEADERS = ['Vendedor', 'Ventas brutas', 'Devoluciones', 'Ventas netas', 'Tasa dev.', 'Unidades', 'Clientes atendidos', 'Tiendas atendidas'];

function Cells({ s, currency, bold }: { s: HistVendedorStats; currency: HistTabProps['currency']; bold?: boolean }) {
  return (
    <>
      <td className={`px-3 py-2 text-right text-gray-900 ${bold ? 'font-bold' : 'font-medium'}`}>{histMoney(s.salesGross, currency)}</td>
      <td className="px-3 py-2 text-right text-gray-600">{histMoney(s.returns, currency)}</td>
      <td className={`px-3 py-2 text-right text-gray-900 ${bold ? 'font-bold' : ''}`}>{histMoney(s.salesNet, currency)}</td>
      <td className="px-3 py-2 text-right text-gray-600">{pct(s.returnRate)}</td>
      <td className="px-3 py-2 text-right text-gray-600">{nf(s.units)}</td>
      <td className="px-3 py-2 text-right text-gray-600">{nf(s.customersServed)}</td>
      <td className="px-3 py-2 text-right text-gray-600">{nf(s.storesServed)}</td>
    </>
  );
}

export default function TabVendedores({ dateRange, currency, granularity, returnsBasis }: HistTabProps) {
  // undefined = everyone; otherwise the seller whose trend is shown (null = "Sin vendedor", asked as key 0).
  const [selected, setSelected] = useState<{ key: number | null; label: string } | undefined>(undefined);
  const keyParam = selected === undefined ? '' : `&salesRepKey=${selected.key ?? 0}`;
  const { data, loading, error } = useHistFetch<HistVendedoresResponse>(
    `/api/dwh/analitica-historica/vendedores?dateRange=${dateRange}&granularity=${granularity}&returnsBasis=${returnsBasis}${keyParam}`,
  );

  if (loading && !data) return <HistLoading />;
  if (error) return <HistError message={error} />;
  if (!data || data.empty || !data.total) return <div className="p-6"><HistEmpty /></div>;

  return (
    <div className="p-4 w-full space-y-3">
      <p className="text-xs text-gray-500">
        Período: {periodLabel(dateRange)}. Devoluciones {RETURNS_BASIS_LABEL[returnsBasis]}, sin IVA. Cada venta se atribuye al vendedor del documento.
      </p>
      <section>
        <SectionTitle>Vendedores</SectionTitle>
        <div className="overflow-x-auto bg-white border border-gray-300 rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {HEADERS.map((h, i) => (
                  <th key={h} className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.map((r, i) => {
                const isSelected = selected !== undefined && selected.key === r.salesRepKey;
                return (
                  <tr
                    key={r.salesRepKey ?? 'none'}
                    onClick={() => setSelected(isSelected ? undefined : { key: r.salesRepKey, label: r.label })}
                    aria-selected={isSelected}
                    className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : i % 2 === 1 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-gray-800">{r.label}</td>
                    <Cells s={r} currency={currency} />
                  </tr>
                );
              })}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="px-3 py-2 text-gray-900 font-bold">Total</td>
                <Cells s={data.total} currency={currency} bold />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-gray-500">
        Tendencia: {selected === undefined ? 'todos los vendedores' : selected.label}. Haga clic en un vendedor para ver su tendencia.
      </p>
      <SalesReturnsChart rows={data.trend} trendMode={data.trendMode} currency={currency} />
    </div>
  );
}
