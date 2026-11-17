import type { ReturnsBasis } from '@/app/api/dwh/lib/query-builder';
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { HistKpis } from '@/app/(app)/analitica-historica/types';
import { histDualSum, histEntityId, histReturnsUsdJoin, histReturnsWhere, histSalesWhere, histUsdJoin } from './sql';
import type { HistRange } from './window';

export interface HistKpiQueries { salesTotalsSql: string; returnsTotalsSql: string; customersSql: string }

// "Clientes" are casa matriz (legal entities), "tiendas" the customer codes under them.
// The three queries behind the headline cards (Resumen, Ventas, Devoluciones):
// sales totals, returns totals and customer counts. Money through histDualSum
// (empty set -> 0, rate-less rows -> NULL USD). Run each and pass the first
// record of each result to mapHistKpis.
export function histKpiQueries(range: HistRange, basis: ReturnsBasis): HistKpiQueries {
  const salesWhere = histSalesWhere(range, 'fsl');
  const returnsWhere = histReturnsWhere(range, basis, 'frl');
  return {
    salesTotalsSql: `
    SELECT ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
           ISNULL(SUM(fsl.QuantitySold), 0) AS UnitsSold
    FROM fact.Fact_Sales_Legacy fsl
    ${histUsdJoin('fsl')}
    WHERE 1 = 1 ${salesWhere}`,
    returnsTotalsSql: `
    SELECT ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')},
           ISNULL(SUM(frl.QuantityReturned), 0) AS UnitsReturned
    FROM fact.Fact_Returns_Legacy frl
    ${histReturnsUsdJoin('frl')}
    WHERE 1 = 1 ${returnsWhere}`,
    customersSql: `
    WITH s AS (
      SELECT fsl.CustomerLegacyKey, SUM(fsl.NetAmount) AS Amt
      FROM fact.Fact_Sales_Legacy fsl WHERE 1 = 1 ${salesWhere}
      GROUP BY fsl.CustomerLegacyKey
    ), r AS (
      SELECT frl.CustomerLegacyKey, SUM(frl.NetAmount) AS Amt
      FROM fact.Fact_Returns_Legacy frl WHERE 1 = 1 ${returnsWhere}
      GROUP BY frl.CustomerLegacyKey
    ), se AS (
      SELECT ${histEntityId('c')} AS EKey, SUM(s.Amt) AS Amt
      FROM s JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = s.CustomerLegacyKey
      GROUP BY ${histEntityId('c')}
    ), re AS (
      SELECT ${histEntityId('c')} AS EKey, SUM(r.Amt) AS Amt
      FROM r JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = r.CustomerLegacyKey
      GROUP BY ${histEntityId('c')}
    )
    SELECT (SELECT COUNT(*) FROM s) AS CustomersWithSales,
           (SELECT COUNT(*) FROM r) AS CustomersWithReturns,
           (SELECT COUNT(*) FROM s LEFT JOIN r ON r.CustomerLegacyKey = s.CustomerLegacyKey
             WHERE s.Amt - ISNULL(r.Amt, 0) > 0) AS CustomersNet,
           (SELECT COUNT(*) FROM se) AS EntitiesWithSales,
           (SELECT COUNT(*) FROM re) AS EntitiesWithReturns,
           (SELECT COUNT(*) FROM se LEFT JOIN re ON re.EKey = se.EKey
             WHERE se.Amt - ISNULL(re.Amt, 0) > 0) AS EntitiesNet`,
  };
}

export function mapHistKpis(
  s: Record<string, unknown> | undefined, r: Record<string, unknown> | undefined, c: Record<string, unknown> | undefined,
): HistKpis {
  const salesGross = dualFromRow(s?.SalesGrossBs, s?.SalesGrossUsd);
  const returns = dualFromRow(r?.ReturnsBs, r?.ReturnsUsd);
  return {
    salesGross,
    returns,
    salesNet: subtractDual(salesGross, returns),
    returnRate: returnRate(returns, salesGross),
    unitsSold: Number(s?.UnitsSold ?? 0),
    unitsReturned: Number(r?.UnitsReturned ?? 0),
    customersWithSales: Number(c?.CustomersWithSales ?? 0),
    customersWithReturns: Number(c?.CustomersWithReturns ?? 0),
    customersNet: Number(c?.CustomersNet ?? 0),
    entitiesWithSales: Number(c?.EntitiesWithSales ?? 0),
    entitiesWithReturns: Number(c?.EntitiesWithReturns ?? 0),
    entitiesNet: Number(c?.EntitiesNet ?? 0),
  };
}
