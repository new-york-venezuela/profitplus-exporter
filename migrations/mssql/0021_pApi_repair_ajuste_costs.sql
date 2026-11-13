-- migrations/mssql/0021_pApi_repair_ajuste_costs.sql
-- Procs used by `bun run ajuste-costs:repair` to correct saCostoHistoricoEntrada.costo on AJUS (inventory
-- adjustment) layers inflated by the 0002 doubling bug and propagated forward by the pre-0020 cost auto-fill.
-- Only AJUS layers that still have stock left (cantidad - cantidad_usada > 0) can be changed, and only the
-- `costo` column: costo_pro, cantidad, cantidad_usada and the saAjusteReng document line stay untouched.
-- Every change is logged under a run_id so it can be restored.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_ajuste_cost_fixes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_ajuste_cost_fixes (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        run_id          VARCHAR(36)      NOT NULL,
        cod_costo_historico_entrada UNIQUEIDENTIFIER NOT NULL,
        costo_old       DECIMAL(18,5)    NOT NULL,
        costo_new       DECIMAL(18,5)    NOT NULL,
        fixed_at_utc    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
        restored_at_utc DATETIME2(3)     NULL
    );
    CREATE INDEX IX_exporter_ajuste_cost_fixes_run ON dbo.__exporter_ajuste_cost_fixes (run_id);
END
GO

-- Sets the cost of ONE open AJUS layer. Idempotent: same cost already set = no-op, nothing logged.
CREATE OR ALTER PROCEDURE [pApiCorregirCostoCapaAjuste]
    ( @sRunId VARCHAR(36), @gCapa UNIQUEIDENTIFIER, @deCostoNuevo DECIMAL(18,5) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF @deCostoNuevo IS NULL OR @deCostoNuevo <= 0
            RAISERROR('El costo nuevo debe ser mayor que cero', 16, 1);

        DECLARE @sTipo CHAR(4), @deCantidad DECIMAL(18,5), @deUsada DECIMAL(18,5), @deOld DECIMAL(18,5);
        SELECT @sTipo = tipo_doc, @deCantidad = cantidad, @deUsada = cantidad_usada, @deOld = costo
        FROM saCostoHistoricoEntrada WHERE cod_costo_historico_entrada = @gCapa;

        IF @sTipo IS NULL
            RAISERROR('Capa de costo no encontrada', 16, 1);
        IF RTRIM(@sTipo) <> 'AJUS'
            RAISERROR('Solo se pueden corregir capas de tipo AJUS', 16, 1);
        IF @deCantidad - @deUsada <= 0
            RAISERROR('La capa ya fue consumida por completo; no se modifica', 16, 1);

        IF @deOld = @deCostoNuevo
        BEGIN
            COMMIT TRAN;
            RETURN;
        END

        INSERT INTO dbo.__exporter_ajuste_cost_fixes (run_id, cod_costo_historico_entrada, costo_old, costo_new)
        VALUES (@sRunId, @gCapa, @deOld, @deCostoNuevo);

        UPDATE saCostoHistoricoEntrada SET costo = @deCostoNuevo
        WHERE cod_costo_historico_entrada = @gCapa;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

-- Puts back costo_old for every layer changed by @sRunId, unless the layer's cost was changed again since
-- (then it is skipped and reported). Returns restored / skipped counts.
CREATE OR ALTER PROCEDURE [pApiRestaurarCostoCapasAjuste]
    ( @sRunId VARCHAR(36) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        SELECT f.id, f.cod_costo_historico_entrada, f.costo_old,
               CASE WHEN c.costo = f.costo_new THEN 1 ELSE 0 END AS restorable
        INTO #pending
        FROM dbo.__exporter_ajuste_cost_fixes f
        JOIN saCostoHistoricoEntrada c ON c.cod_costo_historico_entrada = f.cod_costo_historico_entrada
        WHERE f.run_id = @sRunId AND f.restored_at_utc IS NULL;

        UPDATE c SET costo = p.costo_old
        FROM saCostoHistoricoEntrada c
        JOIN #pending p ON p.cod_costo_historico_entrada = c.cod_costo_historico_entrada
        WHERE p.restorable = 1;

        UPDATE f SET restored_at_utc = SYSUTCDATETIME()
        FROM dbo.__exporter_ajuste_cost_fixes f
        JOIN #pending p ON p.id = f.id
        WHERE p.restorable = 1;

        SELECT SUM(CASE WHEN restorable = 1 THEN 1 ELSE 0 END) AS restored,
               SUM(CASE WHEN restorable = 0 THEN 1 ELSE 0 END) AS skipped
        FROM #pending;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
