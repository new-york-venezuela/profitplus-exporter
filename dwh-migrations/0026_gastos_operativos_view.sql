-- Reclassifies four already-counted, already-IsExcludedFromEbitda=0
-- commission concepts into their own 'Comisiones' category so they're
-- visible as their own row in the Gastos Operativos breakdown instead of
-- buried inside Nomina/Otros. Pure re-labeling -- no concept's
-- inclusion/exclusion changes. E-217's existing CostCenter = 'Ventas'
-- (set by 0024_nomina_cost_center.sql) is left untouched.
UPDATE dim.ExpenseConceptSeed SET Category = 'Comisiones' WHERE ConceptCode IN ('E-217', 'E-213', '134', 'E-111');
GO

-- Load_Dim_ExpenseConcept needs no changes: it already carries seed.Category
-- through generically (see 0025_exclude_nonoperating_otros.sql's MERGE), and
-- IsExcludedFromEbitda's CASE only checks Category values that mean
-- "non-operating" (Intereses/Impuestos/DiferencialCambiario) or ConceptCode
-- '129' -- 'Comisiones' triggers neither branch, so these four concepts stay
-- IsExcludedFromEbitda = 0 exactly as they already were under Nomina/Otros.
-- This migration does NOT EXEC dwh.Load_Dim_ExpenseConcept itself (unlike
-- every other migration in this project, migrations never invoke Load_*
-- procedures directly -- that requires a live Ncake_a connection, which may
-- not be available in every context bun run migrate:dwh runs in, and would
-- block this migration's own CREATE VIEW statement below on an unrelated
-- cross-database dependency). The reclassification takes effect on the next
-- scheduled incremental load, same as every prior seed UPDATE in this
-- project (0025 included).
--
-- Durable, single definition of "real operating expense" spanning both fact
-- tables that can produce one -- see docs/superpowers/specs/
-- 2026-09-15-margen-operativo-accrual-design.md section 2.2. Investigated
-- live 2026-09-15: fact.Fact_Purchases.NetAmount (accrual, ~32.6M/90d) is
-- ~4.5x fact.Fact_CashMovements' MateriaPrima category (cash, ~7.26M/90d) --
-- Profit Plus records purchase invoices reliably but not their eventual
-- bank settlement promptly. Only ~3% of MateriaPrima bank movements
-- (verified via saMovimientoBanco.cob_pag -> saPago.cob_num ->
-- saPagoDocReng.nro_fact -> saFacturaCompra.nro_fact) trace to an
-- already-invoiced purchase -- not enough to safely deduplicate, so
-- MateriaPrima is fully replaced by Fact_Purchases here, not merged with it.
--
-- CREATE OR ALTER VIEW requires being the only statement in its batch, so
-- this is the last statement before the final GO.
CREATE OR ALTER VIEW dwh.vw_GastosOperativos AS
    SELECT fp.DateKey, 'Compras' AS Category, fp.NetAmount AS Amount, 'Fact_Purchases' AS SourceFact
    FROM fact.Fact_Purchases fp
    WHERE fp.IsVoided = 0

    UNION ALL

    SELECT fe.DateKey, ec.Category, fe.Amount, 'Fact_CashMovements' AS SourceFact
    FROM fact.Fact_CashMovements fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.ConceptType = 'Gasto' AND ec.IsExcludedFromEbitda = 0
      AND ec.Category <> 'MateriaPrima';
GO
