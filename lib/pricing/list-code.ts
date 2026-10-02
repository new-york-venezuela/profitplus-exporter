export function nextPriceListCode(existing: string[]): string {
  const taken = new Set(existing.map(c => c.trim()));
  // Only look past the current max so a freed low code is never silently reused.
  let max = 0;
  for (const c of taken) if (/^\d{1,2}$/.test(c)) max = Math.max(max, parseInt(c, 10));
  let n = max + 1;
  while (n <= 99 && taken.has(String(n).padStart(2, '0'))) n++;
  if (n <= 99) return String(n).padStart(2, '0');

  let big = 100;
  for (const c of taken) if (/^\d{3,6}$/.test(c)) big = Math.max(big, parseInt(c, 10) + 1);
  while (taken.has(String(big).padStart(6, '0'))) big++;
  return String(big).padStart(6, '0');
}
