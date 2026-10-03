/** Parses a `[id]` route param: strictly a positive safe integer in plain decimal, otherwise null. */
export function parsePromotionId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}
