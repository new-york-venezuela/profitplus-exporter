// Shared by scripts/dwh-incremental-load.ts and lib/customer-mapping/dwh.ts (kept free of
// side-effecting imports so lib code can use it).
// Ordering note: this script runs all dimension loads, then all fact loads
// (dims-then-facts) — the only ordering requirement is that every fact's
// prerequisite dimension(s) load before that fact does. (An earlier SQL
// Agent job used a different, interleaved ordering; that job was removed —
// see git history, "Remove job agents" — this script is now the only
// scheduled/automatable load path.)
export const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Dim_ExpenseConcept;
EXEC dwh.Load_Dim_Supplier;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
EXEC dwh.Load_Fact_CashMovements;
EXEC dwh.Load_Fact_Purchases;
`;
