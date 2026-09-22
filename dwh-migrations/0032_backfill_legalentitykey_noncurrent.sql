-- Bug found live 2026-09-22 during the whole-branch review of the Depth of
-- Line / Consignment / Cadencia specs: Load_Dim_LegalEntity's step-2
-- backfill (0014_dim_legal_entity.sql) only sets Dim_Customer.LegalEntityKey
-- for IsCurrent = 1 rows. A Fact_Sales row loaded before its customer was
-- SCD2-versioned keeps pointing at the now-historical Dim_Customer row,
-- whose LegalEntityKey would stay NULL forever -- silently dropping that
-- row out of every entity-grain query that inner-joins Dim_LegalEntity
-- (consignmentFlagsQuery in app/api/dwh/vendedores/route.ts, gapQuery and
-- cadenceQuery in profundidad-linea/cadencia). For consignmentFlagsQuery
-- specifically this understates the TotalSales denominator, which RAISES
-- the computed root-billed share and could falsely flag a legal entity as
-- a consignment pattern, wrongly excluding real sales from a seller's
-- commission total.
--
-- Confirmed live 2026-09-22 against DWH_AlimentosNY: zero Dim_Customer rows
-- currently exhibit this gap (no customer has been SCD2-versioned since
-- LegalEntityKey was introduced), so this is a latent-but-real bug, not one
-- currently corrupting production numbers -- fixed now, before it's ever
-- triggered by a real customer record change.
--
-- Fix: same treatment as 0031's SegmentCode backfill -- one-time-resolve
-- LegalEntityKey for every Dim_Customer row (current and historical alike),
-- and redefine Load_Dim_LegalEntity's step 2 to drop its IsCurrent = 1
-- write-restriction so future SCD2 versioning never reopens this gap.

UPDATE c
SET c.LegalEntityKey = le.LegalEntityKey
FROM dim.Dim_Customer c
JOIN dim.Dim_LegalEntity le
  ON le.RootCustomerCode = CASE
       WHEN LTRIM(RTRIM(ISNULL(c.MatrizCode, ''))) <> ''
            AND EXISTS (
                SELECT 1 FROM dim.Dim_Customer p
                WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(c.MatrizCode))
            )
       THEN LTRIM(RTRIM(c.MatrizCode))
       ELSE c.CustomerCode
     END
WHERE c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey;
GO

-- Redefine Load_Dim_LegalEntity's step 2 to drop the IsCurrent = 1
-- restriction on the WRITE (step 1, resolving Dim_LegalEntity itself, is
-- unchanged -- only current rows should ever define a root/StoreCount), so
-- a future SCD2 version of an existing customer also gets its
-- LegalEntityKey populated, not just whichever row was current when this
-- procedure last ran.
CREATE OR ALTER PROCEDURE dwh.Load_Dim_LegalEntity
AS
BEGIN
    SET NOCOUNT ON;

    -- Step 1: resolve/refresh dim.Dim_LegalEntity from currently-active
    -- Dim_Customer rows (root = a customer with no resolvable current
    -- parent; StoreCount = how many current children point at it).
    MERGE dim.Dim_LegalEntity AS tgt
    USING (
        SELECT
            root.CustomerCode AS RootCustomerCode,
            root.CustomerName AS LegalEntityName,
            ISNULL(child_counts.ChildCount, 0) + 1 AS StoreCount
        FROM dim.Dim_Customer root
        LEFT JOIN (
            SELECT LTRIM(RTRIM(c.MatrizCode)) AS ParentCode, COUNT(*) AS ChildCount
            FROM dim.Dim_Customer c
            WHERE c.IsCurrent = 1 AND c.MatrizCode IS NOT NULL AND LTRIM(RTRIM(c.MatrizCode)) <> ''
            GROUP BY LTRIM(RTRIM(c.MatrizCode))
        ) child_counts ON child_counts.ParentCode = root.CustomerCode
        WHERE root.IsCurrent = 1
          AND (
                root.MatrizCode IS NULL OR LTRIM(RTRIM(root.MatrizCode)) = ''
             OR NOT EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(root.MatrizCode))
                )
          )
    ) AS src
    ON tgt.RootCustomerCode = src.RootCustomerCode
    WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
    WHEN NOT MATCHED THEN INSERT (RootCustomerCode, LegalEntityName, StoreCount, LoadedAtUtc)
        VALUES (src.RootCustomerCode, src.LegalEntityName, src.StoreCount, SYSUTCDATETIME());

    -- Step 2: backfill Dim_Customer.LegalEntityKey for EVERY row, current
    -- or historical -- a row's own root/child resolution still depends on
    -- IsCurrent = 1 lookups (its MatrizCode is resolved against the
    -- CURRENT parent, same as before), but the write itself is no longer
    -- restricted to IsCurrent = 1, so a future SCD2 version doesn't reopen
    -- this gap.
    UPDATE c
    SET c.LegalEntityKey = le.LegalEntityKey
    FROM dim.Dim_Customer c
    JOIN dim.Dim_LegalEntity le
      ON le.RootCustomerCode = CASE
           WHEN LTRIM(RTRIM(ISNULL(c.MatrizCode, ''))) <> ''
                AND EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(c.MatrizCode))
                )
           THEN LTRIM(RTRIM(c.MatrizCode))
           ELSE c.CustomerCode
         END
    WHERE c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey;
END
GO
