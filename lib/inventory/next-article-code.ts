// co_art is a plain zero-padded sequential number in this database (verified
// live 2026-08-26: all 166 existing rows are 0000001..0000166, no line/type
// prefix). MAX(numeric co_art) + 1, zero-padded to 7 digits, is a safe
// suggestion — the caller must still re-check uniqueness server-side since
// this is only ever a pre-filled, user-editable suggestion.
export function suggestNextArticleCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const numeric = Number(code);
    if (Number.isInteger(numeric) && numeric > max) max = numeric;
  }
  const next = max + 1;
  return String(next).padStart(7, '0');
}
