/** Pure benefit maths for the prospect profile. Margin is a share of the shelf price. */

export interface MixLine {
  productCode: string;
  productName: string;
  share: number;
  /** Volume-weighted USD cost per unit; null = no data (never 0). */
  costUsd: number | null;
}

/** Percent string ("30", "30.5") to a fraction; null if not finite or outside [0, 99.9]. */
export function parseMargin(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > 99.9) return null;
  return pct / 100;
}

export function shelfPrice(costUsd: number, margin: number): number {
  return costUsd / (1 - margin);
}

export function weeklyBenefit(
  units: number,
  mix: MixLine[],
  margin: number,
): { benefitUsd: number; incomplete: boolean } {
  let benefitUsd = 0;
  let incomplete = false;
  for (const line of mix) {
    if (line.costUsd === null) {
      incomplete = true;
      continue;
    }
    benefitUsd += units * line.share * (shelfPrice(line.costUsd, margin) - line.costUsd);
  }
  return { benefitUsd, incomplete };
}
