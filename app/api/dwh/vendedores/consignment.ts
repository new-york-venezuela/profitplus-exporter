export const DEFAULT_ROOT_SHARE_THRESHOLD = 0.15;

export function isConsignmentPattern(salesOnRoot: number, totalSales: number, threshold: number): boolean {
  if (totalSales <= 0) return false;
  return salesOnRoot / totalSales >= threshold;
}
