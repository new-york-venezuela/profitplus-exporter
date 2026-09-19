IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_invoice_due_date_fixes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_invoice_due_date_fixes (
        id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        co_cli        CHAR(16)      NOT NULL,
        nro_doc       CHAR(20)      NOT NULL,
        fec_venc_old  DATETIME      NOT NULL,
        fec_venc_new  DATETIME      NOT NULL,
        co_us_in      CHAR(6)       NOT NULL,
        fixed_at_utc  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiCorregirFechaVencimientoFactura')
    DROP PROCEDURE pApiCorregirFechaVencimientoFactura;
GO

CREATE PROCEDURE [pApiCorregirFechaVencimientoFactura]
    (
      @sCoCli     CHAR(16),
      @dFecDesde  DATE,
      @dFecHasta  DATE,
      @sCoUsIn    CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        -- Verify customer exists
        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
        BEGIN
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCli);
        END

        DECLARE @sCondPag CHAR(6) = (SELECT cond_pag FROM saCliente WHERE co_cli = @sCoCli);

        -- Refuse to run while the customer's own condición de pago is still
        -- Contado (000001) — there is nothing to correct until the customer
        -- record itself has been fixed in Profit Plus.
        IF @sCondPag IS NULL OR @sCondPag = '000001'
        BEGIN
            RAISERROR('Cliente %s tiene condición de pago Contado (000001) — corrija el cliente en Profit Plus antes de ejecutar esta reparación', 16, 1, @sCoCli);
        END

        DECLARE @iDiasCred INT = (SELECT dias_cred FROM saCondicionPago WHERE co_cond = @sCondPag);
        IF @iDiasCred IS NULL
        BEGIN
            RAISERROR('Condición de pago %s del cliente %s no existe en saCondicionPago', 16, 1, @sCondPag, @sCoCli);
        END

        -- Log every row that will change, BEFORE the UPDATE, so fec_venc_old
        -- reflects the pre-fix value.
        INSERT INTO dbo.__exporter_invoice_due_date_fixes (co_cli, nro_doc, fec_venc_old, fec_venc_new, co_us_in)
        SELECT
            d.co_cli,
            d.nro_doc,
            d.fec_venc,
            DATEADD(day, @iDiasCred, d.fec_emis),
            @sCoUsIn
        FROM saDocumentoVenta d
        WHERE d.co_cli = @sCoCli
          AND d.co_tipo_doc = 'FACT'
          AND d.anulado = 0
          AND d.saldo <> 0
          AND CAST(d.fec_emis AS date) BETWEEN @dFecDesde AND @dFecHasta
          AND d.fec_venc = d.fec_emis;

        UPDATE d
        SET d.fec_venc = DATEADD(day, @iDiasCred, d.fec_emis)
        FROM saDocumentoVenta d
        WHERE d.co_cli = @sCoCli
          AND d.co_tipo_doc = 'FACT'
          AND d.anulado = 0
          AND d.saldo <> 0
          AND CAST(d.fec_emis AS date) BETWEEN @dFecDesde AND @dFecHasta
          AND d.fec_venc = d.fec_emis;

        COMMIT TRAN;

        SELECT nro_doc, fec_venc_old, fec_venc_new
        FROM dbo.__exporter_invoice_due_date_fixes
        WHERE co_cli = @sCoCli AND fixed_at_utc >= DATEADD(second, -5, SYSUTCDATETIME())
        ORDER BY nro_doc;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO
