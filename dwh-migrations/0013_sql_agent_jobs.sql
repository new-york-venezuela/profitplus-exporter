IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Incremental Load')
BEGIN
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

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = 'DWH - Daily AR Snapshot')
BEGIN
    EXEC msdb.dbo.sp_add_job
        @job_name = N'DWH - Daily AR Snapshot',
        @enabled = 0,
        @description = N'Takes one daily snapshot of open AR balances into Fact_AR_Snapshot. Disabled by default — enable and schedule for after business close once ready (spec 2026-08-25-sales-margin-collections-dwh-design.md, section 3.2/5.1).';

    EXEC msdb.dbo.sp_add_jobstep @job_name = N'DWH - Daily AR Snapshot', @step_id = 1, @step_name = N'Snapshot_Fact_AR', @subsystem = N'TSQL', @database_name = N'DWH_AlimentosNY', @command = N'EXEC dwh.Snapshot_Fact_AR;';

    EXEC msdb.dbo.sp_add_jobserver @job_name = N'DWH - Daily AR Snapshot', @server_name = N'(local)';
END
GO
