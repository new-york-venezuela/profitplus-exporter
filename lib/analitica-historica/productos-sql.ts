import { histDualSum, histEntityId, histReturnsUsdJoin, histUsdJoin } from './sql';
import type { HistNivel } from './productos-filter';

const NO_LINEA = 'Sin línea';
const NO_SUBLINEA = 'Sin sublínea';

// Grouping expressions of the Productos master table, over a Dim_Product_Legacy
// alias `p` (the same column names as the current Dim_Product).
function keys(nivel: HistNivel, p: string) {
  const line = `ISNULL(${p}.LineName, '${NO_LINEA}')`;
  const sub = `ISNULL(${p}.SubLineName, '${NO_SUBLINEA}')`;
  if (nivel === 'linea') return { group: line, key: line, label: line, code: 'NULL', linea: line, sublinea: "''" };
  if (nivel === 'sublinea') return { group: `${line}, ${sub}`, key: `${line} + '|' + ${sub}`, label: sub, code: 'NULL', linea: line, sublinea: sub };
  const code = `RTRIM(${p}.ProductCode)`;
  return { group: code, key: code, label: `MAX(ISNULL(${p}.ProductName, ${code}))`, code, linea: `MAX(${line})`, sublinea: `MAX(${sub})` };
}

// `where` strings start with AND: the date window + voided filter (histSalesWhere),
// the categoría condition and the item filter (itemFilterSql, product alias `p`).
export function histCatalogoSalesQuery(nivel: HistNivel, where: string): string {
  const k = keys(nivel, 'p');
  return `
    SELECT ${k.key} AS [Key], ${k.label} AS Label, ${k.code} AS Code, ${k.linea} AS Linea, ${k.sublinea} AS Sublinea,
           ISNULL(SUM(fsl.QuantitySold), 0) AS Units,
           ${histDualSum('fsl', 'NetAmount', 'SalesGrossBs', 'SalesGrossUsd')},
           COUNT(DISTINCT d.YearMonth) AS MonthCount,
           COUNT(DISTINCT ${histEntityId('c')}) AS ClientCount,
           COUNT(DISTINCT fsl.CustomerLegacyKey) AS PosCount
    FROM fact.Fact_Sales_Legacy fsl
    ${histUsdJoin('fsl')}
    JOIN dim.Dim_Product_Legacy p ON p.ProductLegacyKey = fsl.ProductLegacyKey
    JOIN dim.Dim_Customer_Legacy c ON c.CustomerLegacyKey = fsl.CustomerLegacyKey
    JOIN dim.Dim_Date d ON d.DateKey = fsl.DateKey
    WHERE 1 = 1 ${where}
    GROUP BY ${k.group}`;
}

// Same keys as the sales side (alias `pr`), plus the labels so a product that only
// has returns in the range can still be listed.
export function histCatalogoReturnsQuery(nivel: HistNivel, where: string): string {
  const k = keys(nivel, 'pr');
  return `
    SELECT ${k.key} AS [Key], ${k.label} AS Label, ${k.code} AS Code, ${k.linea} AS Linea, ${k.sublinea} AS Sublinea,
           ${histDualSum('frl', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
    FROM fact.Fact_Returns_Legacy frl
    ${histReturnsUsdJoin('frl')}
    JOIN dim.Dim_Product_Legacy pr ON pr.ProductLegacyKey = frl.ProductLegacyKey
    WHERE 1 = 1 ${where}
    GROUP BY ${k.group}`;
}

export const HIST_FILTROS_LINEAS_SQL = `
  SELECT DISTINCT ISNULL(LineName, '${NO_LINEA}') AS Linea, ISNULL(SubLineName, '${NO_SUBLINEA}') AS Sublinea
  FROM dim.Dim_Product_Legacy
  ORDER BY Linea, Sublinea`;

export const HIST_FILTROS_CATEGORIAS_SQL = `
  SELECT DISTINCT CategoryName AS Categoria
  FROM dim.Dim_Product_Legacy
  WHERE CategoryName IS NOT NULL
  ORDER BY Categoria`;
