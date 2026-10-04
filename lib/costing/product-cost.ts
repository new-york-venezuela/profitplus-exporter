import sql from 'mssql';
import { getCostLayers } from './erp-layers';
import { computeFifoCost } from './fifo';
import { getUsdRateAsOf, convertBsdToUsd } from './currency';

export interface RecipeLineInput {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  manualUnitCostUsd: number | null;
}

export interface LineCostResult {
  lineType: 'erp_article' | 'manual';
  coArt: string | null;
  quantity: number;
  costUsd: number | null;
  estimated: boolean;
}

export interface ProductCostResult {
  totalUsd: number;
  lines: LineCostResult[];
  asOfRateDate: string | null;
  incomplete: boolean;
  // Sum of erp_article lines only — excludes manual (non-Profit-Plus)
  // ingredients like water, so it reads "what Profit Plus's real inventory
  // costs us," separate from totalUsd's "what the whole batch costs us."
  // null (not $0) when any erp_article line itself has costUsd === null.
  rawMaterialCostUsd: number | null;
  rawMaterialEstimated: boolean;
}

export async function computeProductCost(
  pool: sql.ConnectionPool,
  lines: RecipeLineInput[],
  asOf: Date = new Date(),
): Promise<ProductCostResult> {
  const usdRate = await getUsdRateAsOf(pool, asOf);

  const lineResults: LineCostResult[] = [];
  let incomplete = usdRate === null && lines.some(l => l.lineType === 'erp_article');

  for (const line of lines) {
    if (line.lineType === 'manual') {
      lineResults.push({
        lineType: 'manual',
        coArt: null,
        quantity: line.quantity,
        costUsd: line.quantity * (line.manualUnitCostUsd ?? 0),
        estimated: false,
      });
      continue;
    }

    const layers = await getCostLayers(pool, line.coArt!);
    const fifo = computeFifoCost(layers, line.quantity);

    if (!fifo.hasData || usdRate === null) {
      incomplete = true;
      lineResults.push({
        lineType: 'erp_article',
        coArt: line.coArt,
        quantity: line.quantity,
        costUsd: null,
        estimated: false,
      });
      continue;
    }

    if (fifo.estimated) incomplete = true;

    lineResults.push({
      lineType: 'erp_article',
      coArt: line.coArt,
      quantity: line.quantity,
      costUsd: convertBsdToUsd(fifo.costBsd, usdRate.rate),
      estimated: fifo.estimated,
    });
  }

  const totalUsd = lineResults.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);

  const rawMaterialLines = lineResults.filter(l => l.lineType === 'erp_article');
  const rawMaterialCostUsd = rawMaterialLines.some(l => l.costUsd === null)
    ? null
    : rawMaterialLines.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);
  const rawMaterialEstimated = rawMaterialLines.some(l => l.estimated);

  return {
    totalUsd,
    lines: lineResults,
    asOfRateDate: usdRate ? usdRate.date.toISOString() : null,
    incomplete,
    rawMaterialCostUsd,
    rawMaterialEstimated,
  };
}
