-- Adds Load_Dim_Supplier and Load_Fact_Purchases as new steps at the END of
-- the existing 'DWH - Incremental Load' job. Same pattern and rationale as
-- 0019_add_expense_jobsteps.sql (which this migration may run before or
-- after, depending on execution order — both are idempotent and each only
-- touches the step that is last AT THE TIME IT RUNS, so running both in
-- either order converges to the same correct end state: every step chains
-- to the next via on_success_action = 3 except the true final step).
--
-- Idempotency note (same reasoning as 0019): the whole block is guarded by
-- a single outer NOT EXISTS(Load_Fact_Purchases) check keyed on the true
-- last step this migration adds, rather than per-statement guards. A
-- per-statement-only guard would leave the @max_step_id-driven
-- sp_update_jobstep call unguarded on re-run: after the first run,
-- @max_step_id would recompute as Load_Fact_Purchases's own step_id (since
-- both new steps already exist), and re-running sp_update_jobstep against
-- it would incorrectly flip Load_Fact_Purchases's on_success_action from 1
-- back to 3, breaking the job's terminal step. Wrapping everything in one
-- guard keyed on the true last step makes this migration a genuine no-op on
-- re-run.
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load')
BEGIN
    DECLARE @job_id UNIQUEIDENTIFIER = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load');

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Fact_Purchases')
    BEGIN
        DECLARE @max_step_id INT = (SELECT MAX(step_id) FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id);
        DECLARE @supplier_step_id INT = @max_step_id + 1;
        DECLARE @purchase_step_id INT = @max_step_id + 2;

        -- The step that was previously last must now continue to the next step.
        EXEC msdb.dbo.sp_update_jobstep @job_id = @job_id, @step_id = @max_step_id, @on_success_action = 3;

        IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Dim_Supplier')
        BEGIN
            EXEC msdb.dbo.sp_add_jobstep
                @job_id = @job_id,
                @step_id = @supplier_step_id,
                @step_name = N'Load_Dim_Supplier',
                @subsystem = N'TSQL',
                @database_name = N'DWH_AlimentosNY',
                @command = N'EXEC dwh.Load_Dim_Supplier;',
                @on_success_action = 3;
        END

        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @purchase_step_id,
            @step_name = N'Load_Fact_Purchases',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Fact_Purchases;',
            @on_success_action = 1;
    END
END
GO
