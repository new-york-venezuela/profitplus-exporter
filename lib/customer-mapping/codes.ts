export function trimCode(raw: unknown): string {
  return raw == null ? '' : String(raw).trim();
}

// Numeric seller codes compare without leading zeros ('000015' == '15'); others compare upper-cased.
export function sellerKey(code: string): string {
  const t = code.trim();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t.toUpperCase();
}

// Returns the ERP's own (trimmed) seller code matching a workbook/CSV code, or null.
export function resolveSeller(raw: string, erpSellers: Iterable<string>): string | null {
  const key = sellerKey(raw);
  if (!key) return null;
  for (const s of erpSellers) {
    if (sellerKey(s) === key) return s.trim();
  }
  return null;
}

// Only used to SUGGEST a likely ERP customer for an unmatched code; never to match silently.
export function looseCustomerKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
