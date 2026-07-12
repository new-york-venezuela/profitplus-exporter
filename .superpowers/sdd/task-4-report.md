# Task 4: Create Test Queries File — REPORT

## Status: DONE

### Deliverable

Created `/tests/mssql/test-queries.sql` with 16 comprehensive test scenarios covering COMPRAS and VENTAS functionality.

**File Details:**
- Location: `tests/mssql/test-queries.sql`
- Size: 4.0K (122 lines)
- Commit: `a22ab31`

### Test Coverage

#### COMPRAS Tests (Tests 1-7):
1. **TEST 1:** Full July 2026 date range query
2. **TEST 2:** Week of July 1-7 (facturas + N/CR)
3. **TEST 3:** Single day July 5 (no results edge case)
4. **TEST 4:** Cross-month range Jun 28 - Jul 10
5. **TEST 5:** June-only query (2 facturas)
6. **TEST 6:** Future date range (empty result)
7. **TEST 7:** N/CR vs FACT comparison with UNION for manual verification

#### VENTAS Tests (Tests 8-14):
8. **TEST 8:** Full July 2026 date range query
9. **TEST 9:** Week of July 1-7 (facturas + N/CR)
10. **TEST 10:** Single day July 2 (1 factura result)
11. **TEST 11:** Cross-month range Jun 28 - Jul 10
12. **TEST 12:** June-only query (2 facturas)
13. **TEST 13:** Past date range (empty result)
14. **TEST 14:** N/CR vs FACT comparison with UNION for manual verification

#### Summary Tests (Tests 15-16):
15. **TEST 15:** Count by `tipo_comprobante` for compras (FACTURA vs NOTA DE CREDITO)
16. **TEST 16:** Count by `tipo_comprobante` for ventas (FACTURA vs NOTA DE CREDITO)

### Execution

Each test includes:
- PRINT label for clear output identification
- Either EXEC call to stored procedure (Tests 1-6, 8-13) or SELECT query (Tests 7, 14-16)
- GO delimiter for proper T-SQL execution
- Expected behavior documented in comments

### Usage

Run all tests via:
```bash
sqlcmd -S localhost,1433 -U sa -P YourStr0ngP@ssw0rd -d ProfitPlus -i tests/mssql/test-queries.sql
```

### Requirements Met

- ✓ Directory created: `tests/mssql/`
- ✓ File created: `test-queries.sql`
- ✓ ~15+ test scenarios (16 total)
- ✓ COMPRAS tests covering date ranges, edge cases, N/CR-to-FACT
- ✓ VENTAS tests mirroring COMPRAS patterns
- ✓ Summary count tests for verification
- ✓ Each test has PRINT label
- ✓ Runnable via sqlcmd with docker connection details
- ✓ 122 lines (exceeds 100+ requirement)
- ✓ Committed to git

### Git Status

```
a22ab31 test: add comprehensive test queries for compras/ventas stored procedures
41be8ff Add MSSQL Docker mock ERP connection variables to .env.example
fd41f77 feat: Add MSSQL database initialization script with schema and stored procedures
```

### Next Steps

Task 4 complete. Ready for:
- Task 5: Update `.env.example` with MSSQL Docker credentials
- Task 6: Create Docker README documentation
- Task 7: Final verification and container startup testing
