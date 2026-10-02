const MAX_LEN = 60;
const SEP = ' · ';

export function formatShortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-');
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, Math.max(max, 0));
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function buildSegmentName(i: { customerName: string; reason: string; endsOn: string; today: string }): string {
  const customer = i.customerName.trim().replace(/\s+/g, ' ');
  const reason = i.reason.trim().replace(/\s+/g, ' ');
  const suffix = `${SEP}hasta ${formatShortDate(i.endsOn, i.today)}`;
  const budget = MAX_LEN - suffix.length;

  if (!reason) return clip(customer, budget) + suffix;

  const room = budget - SEP.length;
  if (customer.length + reason.length <= room) return `${customer}${SEP}${reason}${suffix}`;

  // Shrink the customer first (floor 12), then the reason (floor 6).
  let c = customer.length;
  let r = reason.length;
  let over = c + r - room;
  const cutC = Math.min(over, Math.max(c - 12, 0)); c -= cutC; over -= cutC;
  const cutR = Math.min(over, Math.max(r - 6, 0)); r -= cutR; over -= cutR;
  if (over > 0) c = Math.max(c - over, 1);
  return `${clip(customer, c)}${SEP}${clip(reason, r)}${suffix}`;
}

/** Next free zero-padded numeric 6-digit tip_cli code. Non-numeric codes are ignored for the max but never collided with. */
export function nextTipCliCode(existing: string[]): string {
  const taken = new Set(existing.map(c => c.trim()));
  let max = 0;
  for (const c of taken) if (/^\d{1,6}$/.test(c)) max = Math.max(max, parseInt(c, 10));
  let n = max + 1;
  while (taken.has(String(n).padStart(6, '0'))) n++;
  if (n > 999_999) throw new Error('Sin códigos de segmento disponibles');
  return String(n).padStart(6, '0');
}
