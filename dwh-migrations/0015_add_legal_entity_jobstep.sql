-- 0013_sql_agent_jobs.sql created the 'DWH - Incremental Load' SQL Agent job
-- with 9 explicit steps, guarded by "IF NOT EXISTS (... sysjobs ...)" — so on
-- any server where that job was already created (i.e. any real
-- production/staging server that has run 0013 before this file existed),
-- re-running all migrations is a no-op for the job and the gap below can
-- never be closed by re-migrating. This migration extends the EXISTING job
-- (idempotently) rather than editing 0013 in place, per this project's
-- "numbered migrations are never edited" convention (README.md).
--
-- Task 1 (0014_dim_legal_entity.sql) added dwh.Load_Dim_LegalEntity, which
-- MUST run immediately after Load_Dim_Customer — it reads
-- Dim_Customer.MatrizCode, populated by Load_Dim_Customer. 0013 never added
-- a jobstep for it, so on every server the job runs it silently skips
-- Load_Dim_LegalEntity forever, leaving Dim_Customer.LegalEntityKey NULL for
-- every row and breaking every INNER JOIN against dim.Dim_LegalEntity.
--
-- This migration inserts 'Load_Dim_LegalEntity' as step 4 (immediately after
-- 'Load_Dim_Customer', step 3), relying on sp_add_jobstep's documented
-- behavior of shifting any existing step at/after the requested @step_id up
-- by one (verified empirically against a live SQL Server instance: inserting
-- at an occupied step_id renumbers step_id, on_success_step_id, and
-- on_fail_step_id references for every subsequent step, preserving step
-- names/commands unchanged) — so the original steps 4-9
-- (Load_Dim_Product..Load_Fact_Collections) become steps 5-10 automatically,
-- with no manual renumbering needed.
--
-- Idempotent: guarded by checking msdb.dbo.sysjobsteps for a step named
-- 'Load_Dim_LegalEntity' on this job before adding it, per this project's
-- IF NOT EXISTS / safe-to-rerun convention (dwh-migrations/README.md).
--
-- Two scenarios both land in the same state (10 steps, LegalEntity as step 4):
--   1. Job already exists (created by a prior run of 0013, before this file
--      existed) with the original 9-step gap -> this migration inserts the
--      missing step and shifts 4-9 to 5-10.
--   2. Fresh server, migrating 0001-0015 in one pass -> 0013 creates the job
--      WITH the gap (it has no knowledge of 0014/0015), then this migration
--      runs immediately after and fixes it the same way. 0013 is never
--      touched, so this path is not a special case at all - it is handled by
--      the exact same idempotent check as scenario 1.
IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Incremental Load')
BEGIN
    -- Defensive fallback only (should not be reachable in practice: 0013 runs
    -- before this file in every migration pass and always creates the job).
    -- If some future change ever removes 0013 or reorders migrations, create
    -- the job here too rather than failing outright.
    EXEC msdb.dbo.sp_add_job
        @job_name = N'DWH - Incremental Load',
        @enabled = 0,
        @description = N'Loads all DWH_AlimentosNY dimensions and transaction facts from the Ncake_a ERP, in dependency order. Disabled by default — enable and set a schedule once the business has decided a load cadence (spec 2026-08-25-sales-margin-collections-dwh-design.md, section 5.1).';

    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 1, @step_name = N'Load_Dim_Currency', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Currency;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 2, @step_name = N'Load_Fact_ExchangeRate', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_ExchangeRate;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 3, @step_name = N'Load_Dim_Customer', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Customer;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 4, @step_name = N'Load_Dim_Product', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Product;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 5, @step_name = N'Load_Dim_SalesRep', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_SalesRep;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 6, @step_name = N'Load_Dim_Warehouse', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Dim_Warehouse;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 7, @step_name = N'Load_Fact_Sales', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Sales;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 8, @step_name = N'Load_Fact_Returns', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Returns;';
    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Incremental Load', @step_id = 9, @step_name = N'Load_Fact_Collections', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Load_Fact_Collections;';

    EXEC msdb.dbo.sp_add_jobserver @job_name = N'DWH - Incremental Load', @server_name = N'(local)';
END
GO

-- Insert the missing step. sp_add_jobstep shifts any existing step at/after
-- @step_id = 4 up by one (Load_Dim_Product 4->5, Load_Dim_SalesRep 5->6,
-- Load_Dim_Warehouse 6->7, Load_Fact_Sales 7->8, Load_Fact_Returns 8->9,
-- Load_Fact_Collections 9->10), landing Load_Dim_LegalEntity at step 4,
-- immediately after Load_Dim_Customer (step 3).
IF NOT EXISTS (
    SELECT 1
    FROM msdb.dbo.sysjobsteps js
    JOIN msdb.dbo.sysjobs j ON j.job_id = js.job_id
    WHERE j.name = N'DWH - Incremental Load' AND js.step_name = N'Load_Dim_LegalEntity'
)
BEGIN
    EXEC msdb.dbo.sp_add_jobstep
        @job_name = N'DWH - Incremental Load',
        @step_id = 4,
        @step_name = N'Load_Dim_LegalEntity',
        @subsystem = N'TSQL',
        @database_name = N'DWH_AlimentosNY',
        @command = N'EXEC dwh.Load_Dim_LegalEntity;';
END
GO
