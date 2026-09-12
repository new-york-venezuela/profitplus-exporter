-- Adds Load_Dim_ExpenseConcept and Load_Fact_Expenses as new steps at the
-- END of the existing 'DWH - Incremental Load' job (after whatever the
-- current last step is — Load_Fact_Collections in every scenario as of
-- 2026-09-12), then sets @on_success_action = 3 (go to next step) on the
-- FORMER last step and on Load_Dim_ExpenseConcept, leaving the true new
-- last step (Load_Fact_Expenses) at @on_success_action = 1 (quit reporting
-- success) — same fix pattern as 0016_fix_jobstep_success_action.sql, but
-- targeted at just the steps this migration touches rather than a full
-- dynamic re-normalization (0016 already normalized every step that existed
-- at the time it ran; this migration only needs to handle the NEW steps it
-- adds and the one existing step whose on_success_action must change from
-- 1 to 3 now that something follows it).
--
-- Idempotency note: everything this migration does is wrapped in a single
-- outer NOT EXISTS(Load_Fact_Expenses) guard rather than per-statement
-- IF NOT EXISTS checks. This was found necessary live during this
-- migration's own re-run verification on 2026-09-12: an earlier version
-- guarded only the two sp_add_jobstep calls individually, leaving the
-- @max_step_id-driven sp_update_jobstep call (which flips the "former last
-- step" to on_success_action = 3) unguarded. On a second run, @max_step_id
-- recomputed as the NEW highest step_id — Load_Fact_Expenses itself, since
-- both new steps already existed — and that call incorrectly flipped
-- Load_Fact_Expenses's own on_success_action from 1 to 3, breaking the
-- job's terminal step. Wrapping the whole block in one guard keyed on the
-- true last step (Load_Fact_Expenses) makes the entire migration a genuine
-- no-op on re-run.
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load')
BEGIN
    DECLARE @job_id UNIQUEIDENTIFIER = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load');

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Fact_Expenses')
    BEGIN
        DECLARE @max_step_id INT = (SELECT MAX(step_id) FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id);
        DECLARE @concept_step_id INT = @max_step_id + 1;
        DECLARE @expense_step_id INT = @max_step_id + 2;

        -- The step that was previously last must now continue to the next step.
        EXEC msdb.dbo.sp_update_jobstep @job_id = @job_id, @step_id = @max_step_id, @on_success_action = 3;

        IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Dim_ExpenseConcept')
        BEGIN
            EXEC msdb.dbo.sp_add_jobstep
                @job_id = @job_id,
                @step_id = @concept_step_id,
                @step_name = N'Load_Dim_ExpenseConcept',
                @subsystem = N'TSQL',
                @database_name = N'DWH_AlimentosNY',
                @command = N'EXEC dwh.Load_Dim_ExpenseConcept;',
                @on_success_action = 3;
        END

        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @expense_step_id,
            @step_name = N'Load_Fact_Expenses',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Fact_Expenses;',
            @on_success_action = 1;
    END
END
GO
