-- 0013_sql_agent_jobs.sql created every jobstep of 'DWH - Incremental Load'
-- (and 0015_add_legal_entity_jobstep.sql's defensive fallback block, plus
-- 0015's own Load_Dim_LegalEntity insert) via sp_add_jobstep without ever
-- passing @on_success_action. sp_add_jobstep's documented default for
-- @on_success_action is 1 ("Quit the job reporting success"), NOT 3 ("Go to
-- the next step"). That means every step of this job — as created today —
-- runs step 1 (Load_Dim_Currency) and then quits, silently never executing
-- steps 2-10 (including Load_Dim_LegalEntity, which the whole
-- customer-legal-entity-grouping feature depends on, and every other
-- dimension/fact load in the job) if the job is ever enabled per
-- dwh-migrations/README.md's "Enabling the SQL Agent jobs" instructions.
--
-- This fixes every non-final step of 'DWH - Incremental Load' to
-- @on_success_action = 3 (go to the next step), leaving the final step
-- (whichever step currently has the highest step_id — Load_Fact_Collections,
-- step 10, in every real scenario since this migration runs after 0015) at
-- @on_success_action = 1 (quit reporting success), since there is nothing
-- after it to continue to.
--
-- sp_update_jobstep is naturally idempotent — setting @on_success_action to
-- a value it may already hold is a no-op — so this migration doesn't need
-- CREATE/INSERT-style guarding. It still checks the job exists first, per
-- this project's IF EXISTS / safe-to-rerun convention (dwh-migrations/
-- README.md), so it doesn't fail if the job somehow doesn't exist yet in
-- some unusual migration ordering.
--
-- Driven dynamically off msdb.dbo.sysjobsteps (rather than hardcoding step
-- ids 1-9) so this migration correctly targets whatever steps exist by the
-- time it runs, regardless of which path created/extended the job (0013's
-- direct creation, 0013 followed by 0015's insert, or 0015's own defensive
-- fallback creation block) — in every real scenario given 0015 already ran
-- first, that's the 10-step job with Load_Dim_LegalEntity at step 4.
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load')
BEGIN
    DECLARE @job_id UNIQUEIDENTIFIER = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load');
    DECLARE @max_step_id INT = (SELECT MAX(step_id) FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id);

    DECLARE @step_id INT, @step_name SYSNAME, @on_success_action INT;
    DECLARE step_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT step_id, step_name FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id;

    OPEN step_cursor;
    FETCH NEXT FROM step_cursor INTO @step_id, @step_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- EXEC's named-parameter syntax only accepts a simple scalar/variable
        -- value, not an inline CASE expression, so compute it first.
        SET @on_success_action = CASE WHEN @step_id = @max_step_id THEN 1 ELSE 3 END;

        EXEC msdb.dbo.sp_update_jobstep
            @job_id = @job_id,
            @step_id = @step_id,
            @on_success_action = @on_success_action;

        FETCH NEXT FROM step_cursor INTO @step_id, @step_name;
    END
    CLOSE step_cursor;
    DEALLOCATE step_cursor;
END
GO
