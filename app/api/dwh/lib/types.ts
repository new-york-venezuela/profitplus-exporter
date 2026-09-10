export type GroupBy = string;

export interface ApiQueryParams {
  dateRange: '30d' | '90d' | '12m';
  currency: 'bs' | 'usd';
  groupBy?: GroupBy;
  parentKey?: string; // e.g., salesRepKey=123 when drilling into products for that rep
}

export function parseDateRange(range: string): { days: number } {
  const ranges: Record<string, number> = { '30d': 30, '90d': 90, '12m': 365 };
  return { days: ranges[range] ?? 365 };
}
