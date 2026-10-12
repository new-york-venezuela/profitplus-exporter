// Histórico 2025 shows calendar 2025 only. fact.Fact_Sales_Legacy / Fact_Returns_Legacy still hold Jan 2025 -
// Feb 2026 (scripts/dwh-legacy-2025-import.ts is unchanged); Jan-Feb 2026 are simply not shown anywhere.
export const HISTORICO_FROM_KEY = 20250101 as const;
export const HISTORICO_TO_KEY = 20251231 as const;

export const HISTORICO_SALES_WINDOW = `AND fsl.DateKey BETWEEN ${HISTORICO_FROM_KEY} AND ${HISTORICO_TO_KEY}`;
// Returns are windowed by the ORIGINAL factura's date (OriginalInvoiceDateKey), like the rest of Analítica.
export const HISTORICO_RETURNS_WINDOW = `AND frl.OriginalInvoiceDateKey BETWEEN ${HISTORICO_FROM_KEY} AND ${HISTORICO_TO_KEY}`;
