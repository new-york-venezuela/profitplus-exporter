-- 0014_dim_legal_entity.sql added Dim_Customer.MatrizCode and wired it into
-- Load_Dim_Customer's SCD2 change-detection/INSERT going forward, but that
-- procedure only touches a current row when its source saCliente.validador
-- has advanced past the stored watermark. Customer rows that were already
-- current (and whose source row hasn't changed since) never re-enter that
-- diff, so MatrizCode was silently left NULL for every customer loaded
-- before this migration -- in particular every IsLegalEntity = 1 parent/child
-- account already in the warehouse. This is a one-time correction of a load
-- defect (backfilling data that should have been set at original insert
-- time), not a new business-meaningful change, so it updates
-- dim.Dim_Customer in place rather than opening a new SCD2 version.
UPDATE tgt
SET tgt.MatrizCode = NULLIF(RTRIM(src.matriz), '')
FROM dim.Dim_Customer tgt
INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
WHERE tgt.IsCurrent = 1
  AND ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS;
GO

-- Re-run so LegalEntityKey picks up the MatrizCode values just backfilled
-- above (dwh-incremental-load.ts already runs this after Load_Dim_Customer
-- on every subsequent load, but that alone can't fix rows this migration
-- has not applied yet).
EXEC dwh.Load_Dim_LegalEntity;
GO
