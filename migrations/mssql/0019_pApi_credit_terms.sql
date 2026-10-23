-- migrations/mssql/0019_pApi_credit_terms.sql
-- Procs used by `bun run credit-terms:apply` to repair customer credit terms and the due dates of
-- unpaid invoices. Invoice due dates come from the customer's saCliente.cond_pag (saCondicionPago.dias_cred);
-- saCliente.plaz_pag alone changes nothing. Every change is logged under a run_id so it can be restored.
-- Only FACT documents with saldo <> 0 and not voided are ever touched. Writes land in saCliente,
-- saDocumentoVenta.fec_venc, saFacturaVenta.fec_venc and saFacturaVenta.co_cond.

-- 35-day term (the ERP ships 7/8/9/10/15/21/30/45/60/90 only). Cloned from 000004 so every NOT NULL column is valid.
IF NOT EXISTS (SELECT 1 FROM saCondicionPago WHERE co_cond = '000015')
BEGIN
    INSERT INTO saCondicionPago (co_cond, cond_des, dias_cred, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, rowguid)
    SELECT '000015', 'Credito 35 dias', 35, 'PROFIT', co_sucu_in, GETDATE(), 'PROFIT', co_sucu_mo, GETDATE(), revisado, NEWID()
    FROM saCondicionPago WHERE co_cond = '000004';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_credit_term_customer_fixes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_credit_term_customer_fixes (
        id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        run_id        VARCHAR(36)   NOT NULL,
        co_cli        CHAR(16)      NOT NULL,
        cond_pag_old  CHAR(6)       NULL,
        plaz_pag_old  INT           NULL,
        cond_pag_new  CHAR(6)       NOT NULL,
        plaz_pag_new  INT           NOT NULL,
        co_us_mo      CHAR(6)       NOT NULL,
        fixed_at_utc  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
        restored_at_utc DATETIME2(3) NULL
    );
    CREATE INDEX IX_credit_term_customer_fixes_run ON dbo.__exporter_credit_term_customer_fixes (run_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_credit_term_invoice_fixes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_credit_term_invoice_fixes (
        id               INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        run_id           VARCHAR(36)   NOT NULL,
        co_cli           CHAR(16)      NOT NULL,
        nro_doc          CHAR(20)      NOT NULL,
        fec_emis         SMALLDATETIME NOT NULL,
        saldo            DECIMAL(18,2) NULL,
        fec_venc_old     SMALLDATETIME NULL,
        fv_fec_venc_old  SMALLDATETIME NULL,
        fec_venc_new     SMALLDATETIME NOT NULL,
        co_cond_old      CHAR(6)       NULL,
        co_cond_new      CHAR(6)       NOT NULL,
        co_us_in         CHAR(6)       NOT NULL,
        fixed_at_utc     DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
        restored_at_utc  DATETIME2(3)  NULL
    );
    CREATE INDEX IX_credit_term_invoice_fixes_run ON dbo.__exporter_credit_term_invoice_fixes (run_id);
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarCondicionPagoCliente]
    ( @sRunId VARCHAR(36), @sCoCli CHAR(16), @sCoCond CHAR(6), @iPlazPag INT, @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoCondTrim VARCHAR(6) = RTRIM(@sCoCond);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        DECLARE @iDias INT = (SELECT dias_cred FROM saCondicionPago WHERE co_cond = @sCoCond);
        IF @iDias IS NULL
            RAISERROR('Condicion de pago %s no existe', 16, 1, @sCoCondTrim);
        IF @iDias <> @iPlazPag
            RAISERROR('Condicion de pago %s no coincide con el plazo indicado', 16, 1, @sCoCondTrim);

        DECLARE @sOldCond CHAR(6), @iOldPlaz INT;
        SELECT @sOldCond = cond_pag, @iOldPlaz = plaz_pag FROM saCliente WHERE co_cli = @sCoCli;

        -- Idempotent: nothing to change, nothing to log.
        IF @sOldCond = @sCoCond AND @iOldPlaz = @iPlazPag
        BEGIN
            COMMIT TRAN;
            RETURN;
        END

        INSERT INTO dbo.__exporter_credit_term_customer_fixes
            (run_id, co_cli, cond_pag_old, plaz_pag_old, cond_pag_new, plaz_pag_new, co_us_mo)
        VALUES (@sRunId, @sCoCli, @sOldCond, @iOldPlaz, @sCoCond, @iPlazPag, @sCoUsMo);

        UPDATE saCliente
        SET cond_pag = @sCoCond, plaz_pag = @iPlazPag, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

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

-- Recomputes fec_venc (= fec_emis + dias_cred of the customer's CURRENT cond_pag) for the customer's unpaid
-- FACT invoices, in saDocumentoVenta and saFacturaVenta, and aligns saFacturaVenta.co_cond. Run it after
-- pApiActualizarCondicionPagoCliente. Returns the rows it changed.
CREATE OR ALTER PROCEDURE [pApiCorregirVencimientosFacturasCliente]
    ( @sRunId VARCHAR(36), @sCoCli CHAR(16), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);

        DECLARE @sCond CHAR(6) = (SELECT cond_pag FROM saCliente WHERE co_cli = @sCoCli);
        DECLARE @iDias INT = (SELECT dias_cred FROM saCondicionPago WHERE co_cond = @sCond);
        IF @iDias IS NULL
            RAISERROR('Cliente %s sin condicion de pago valida', 16, 1, @sCoCliTrim);
        IF @iDias = 0
            RAISERROR('Cliente %s tiene condicion de pago Contado: corrija el cliente antes de reparar sus facturas', 16, 1, @sCoCliTrim);

        -- Changed rows are captured first: UPDATE ... OUTPUT is not allowed on tables with triggers.
        SELECT d.nro_doc, d.fec_emis, d.saldo, d.fec_venc AS fec_venc_old, fv.fec_venc AS fv_fec_venc_old,
               CAST(DATEADD(day, @iDias, d.fec_emis) AS SMALLDATETIME) AS fec_venc_new,
               fv.co_cond AS co_cond_old
        INTO #changes
        FROM saDocumentoVenta d
        INNER JOIN saFacturaVenta fv ON fv.doc_num = d.nro_doc
        WHERE d.co_cli = @sCoCli
          AND d.co_tipo_doc = 'FACT'
          AND ISNULL(d.anulado, 0) = 0
          AND d.saldo <> 0
          AND ( d.fec_venc <> DATEADD(day, @iDias, d.fec_emis)
                OR fv.fec_venc <> DATEADD(day, @iDias, d.fec_emis)
                OR fv.co_cond <> @sCond );

        INSERT INTO dbo.__exporter_credit_term_invoice_fixes
            (run_id, co_cli, nro_doc, fec_emis, saldo, fec_venc_old, fv_fec_venc_old, fec_venc_new, co_cond_old, co_cond_new, co_us_in)
        SELECT @sRunId, @sCoCli, nro_doc, fec_emis, saldo, fec_venc_old, fv_fec_venc_old, fec_venc_new, co_cond_old, @sCond, @sCoUsIn
        FROM #changes;

        UPDATE d SET d.fec_venc = c.fec_venc_new
        FROM saDocumentoVenta d INNER JOIN #changes c ON c.nro_doc = d.nro_doc
        WHERE d.co_tipo_doc = 'FACT';

        UPDATE fv SET fv.fec_venc = c.fec_venc_new, fv.co_cond = @sCond
        FROM saFacturaVenta fv INNER JOIN #changes c ON c.nro_doc = fv.doc_num;

        COMMIT TRAN;

        SELECT RTRIM(nro_doc) AS nroDoc, @sCoCliTrim AS coCli,
               CONVERT(char(10), fec_emis, 23) AS fecEmis,
               CONVERT(char(10), fec_venc_old, 23) AS fecVencOld,
               CONVERT(char(10), fec_venc_new, 23) AS fecVencNew,
               saldo
        FROM #changes ORDER BY nro_doc;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

-- Restores customers of a run. A customer edited since the run (current value <> logged new value) is skipped.
-- Returns one row per audit entry: status ('restored' | 'skipped'), item key and reason.
CREATE OR ALTER PROCEDURE [pApiRestaurarCondicionPagoCliente]
    ( @sRunId VARCHAR(36), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        SELECT f.id, f.co_cli, f.cond_pag_old, f.plaz_pag_old,
               CASE WHEN c.cond_pag = f.cond_pag_new AND c.plaz_pag = f.plaz_pag_new THEN 1 ELSE 0 END AS ok
        INTO #todo
        FROM dbo.__exporter_credit_term_customer_fixes f
        INNER JOIN saCliente c ON c.co_cli = f.co_cli
        WHERE f.run_id = @sRunId AND f.restored_at_utc IS NULL;

        UPDATE c SET c.cond_pag = t.cond_pag_old, c.plaz_pag = t.plaz_pag_old, c.co_us_mo = @sCoUsMo, c.fe_us_mo = GETDATE()
        FROM saCliente c INNER JOIN #todo t ON t.co_cli = c.co_cli AND t.ok = 1;

        UPDATE f SET f.restored_at_utc = SYSUTCDATETIME()
        FROM dbo.__exporter_credit_term_customer_fixes f INNER JOIN #todo t ON t.id = f.id AND t.ok = 1;

        COMMIT TRAN;

        SELECT CASE WHEN ok = 1 THEN 'restored' ELSE 'skipped' END AS status, RTRIM(co_cli) AS [key],
               CASE WHEN ok = 1 THEN '' ELSE 'el cliente cambió después de la corrida' END AS reason
        FROM #todo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

-- Restores invoices of a run. An invoice edited since the run (fec_venc or co_cond differ from the logged
-- new values, in either table) is skipped.
CREATE OR ALTER PROCEDURE [pApiRestaurarVencimientosFacturas]
    ( @sRunId VARCHAR(36), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        SELECT f.id, f.nro_doc, f.fec_venc_old, f.fv_fec_venc_old, f.co_cond_old,
               CASE WHEN d.fec_venc = f.fec_venc_new AND fv.fec_venc = f.fec_venc_new AND fv.co_cond = f.co_cond_new
                    THEN 1 ELSE 0 END AS ok
        INTO #todo
        FROM dbo.__exporter_credit_term_invoice_fixes f
        INNER JOIN saDocumentoVenta d ON d.nro_doc = f.nro_doc AND d.co_tipo_doc = 'FACT'
        INNER JOIN saFacturaVenta fv ON fv.doc_num = f.nro_doc
        WHERE f.run_id = @sRunId AND f.restored_at_utc IS NULL;

        UPDATE d SET d.fec_venc = t.fec_venc_old
        FROM saDocumentoVenta d INNER JOIN #todo t ON t.nro_doc = d.nro_doc AND t.ok = 1
        WHERE d.co_tipo_doc = 'FACT';

        UPDATE fv SET fv.fec_venc = t.fv_fec_venc_old, fv.co_cond = t.co_cond_old
        FROM saFacturaVenta fv INNER JOIN #todo t ON t.nro_doc = fv.doc_num AND t.ok = 1;

        UPDATE f SET f.restored_at_utc = SYSUTCDATETIME()
        FROM dbo.__exporter_credit_term_invoice_fixes f INNER JOIN #todo t ON t.id = f.id AND t.ok = 1;

        COMMIT TRAN;

        SELECT CASE WHEN ok = 1 THEN 'restored' ELSE 'skipped' END AS status, RTRIM(nro_doc) AS [key],
               CASE WHEN ok = 1 THEN '' ELSE 'la factura cambió después de la corrida' END AS reason
        FROM #todo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
