# Task 4: API Infrastructure for Drill-Down Support

## Status: DONE

## Summary
Created two utility/infrastructure files in `app/api/dwh/lib/` for API drill-down and date filtering support.

## Files Created

### 1. `app/api/dwh/lib/types.ts`
- Exports `GroupBy` type (string alias)
- Exports `ApiQueryParams` interface with properties:
  - `dateRange: '30d' | '90d' | '12m'`
  - `currency: 'bs' | 'usd'`
  - `groupBy?: GroupBy` (optional)
  - `parentKey?: string` (for drill-down context, e.g., salesRepKey)
- Exports `parseDateRange()` function to convert date range strings to day counts

### 2. `app/api/dwh/lib/query-builder.ts`
- Imports `getDwhPool` from `@/lib/db/dwh-mssql`
- Exports `getUsdRate()` async function
  - Queries `fact.Fact_ExchangeRate` with `dim.Dim_Currency` join
  - Returns `number | null` for USD rate
  - Includes error handling (returns null on failure)
- Exports `buildDateWhereClause()` function
  - Builds WHERE clause fragment for date filtering
  - Supports 30d, 90d, 12m ranges
  - Uses SQL Server `CONVERT()` and `FORMAT()` for DateKey format (YYYYMMDD)
  - Parameterized table name support

## Verification

### TypeScript Compilation
✓ Both files compile without errors when using `tsc --noEmit --project tsconfig.json`
✓ Path alias `@/lib/db/dwh-mssql` resolves correctly via tsconfig.json
✓ No new TypeScript errors introduced to the project

### Imports
✓ Query builder correctly imports `getDwhPool` from `@/lib/db/dwh-mssql`
✓ Query builder correctly imports types from `./types`
✓ All exports are properly typed and accessible

## Implementation Notes

- Both files are pure utilities with no test requirements (TypeScript compilation is sufficient)
- `getUsdRate()` follows existing dashboard query pattern from `app/api/dwh/dashboard/route.ts`
- SQL syntax uses MSSQL/T-SQL conventions to match project database (DWH_AlimentosNY)
- Date filtering uses `DateKey` format (YYYYMMDD integer) consistent with DWH schema
- Helper functions will be consumed by Tasks 5-14 (API routes for drill-down endpoints)

## Next Steps

These infrastructure files are ready for use by:
- Task 5: Drill-down API routes
- Task 6-14: Additional analytics endpoints
