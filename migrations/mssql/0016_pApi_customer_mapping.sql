-- migrations/mssql/0016_pApi_customer_mapping.sql
-- Procs used by `bun run mapping:apply` (customer seller / group data-quality fix).
-- Changes ONLY: saSegmento (insert), saCliente.co_seg / co_ven, and the seller (co_ven)
-- of a sales invoice or customer return header.
-- For a FACT, the invoice's own saDocumentoVenta ledger row is mirrored too, guarded by
-- the invoice's customer. A customer return (DEV) is NOT mirrored into the ledger: a
-- credit note has its own number (linked via doc_orig/nro_orig), so matching by the
-- return's doc_num could hit another customer's credit note.
-- Header rows are stamped with co_us_mo / fe_us_mo (which also bumps `validador`,
-- so the DWH incremental loads pick the change up). Annulled documents are refused.

CREATE OR ALTER PROCEDURE [pApiInsertarSegmento]
    ( @sCoSeg CHAR(6), @sSegDes VARCHAR(60), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoSeg);
        IF EXISTS (SELECT 1 FROM saSegmento WHERE co_seg = @sCoSeg)
            RAISERROR('El segmento %s ya existe', 16, 1, @sTrim);
        INSERT INTO saSegmento (co_seg, seg_des, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid)
        VALUES (@sCoSeg, @sSegDes, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), NEWID());
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        RAISERROR(@ErrorMessage, 16, @ErrorNumber);
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarSegmentoCliente]
    ( @sCoCli CHAR(16), @sCoSeg CHAR(6), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoSegTrim VARCHAR(6)  = RTRIM(@sCoSeg);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        IF NOT EXISTS (SELECT 1 FROM saSegmento WHERE co_seg = @sCoSeg)
            RAISERROR('Segmento %s no encontrado', 16, 1, @sCoSegTrim);

        UPDATE saCliente
        SET co_seg = @sCoSeg, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
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

CREATE OR ALTER PROCEDURE [pApiCorregirVendedorDocumento]
    ( @sTipo VARCHAR(4), @sNroDoc CHAR(20), @sCoVen CHAR(6), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sDocTrim VARCHAR(20) = RTRIM(@sNroDoc);
        DECLARE @sVenTrim VARCHAR(6)  = RTRIM(@sCoVen);

        -- Inactive sellers are allowed: rollback may need to restore a seller deactivated since.
        IF NOT EXISTS (SELECT 1 FROM saVendedor WHERE co_ven = @sCoVen)
            RAISERROR('Vendedor %s no encontrado', 16, 1, @sVenTrim);

        IF @sTipo = 'FACT'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM saFacturaVenta WHERE doc_num = @sNroDoc)
                RAISERROR('Documento %s no encontrado', 16, 1, @sDocTrim);
            IF EXISTS (SELECT 1 FROM saFacturaVenta WHERE doc_num = @sNroDoc AND anulado = 1)
                RAISERROR('Documento %s anulado', 16, 1, @sDocTrim);

            UPDATE saFacturaVenta
            SET co_ven = @sCoVen, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
            WHERE doc_num = @sNroDoc;

            UPDATE saDocumentoVenta SET co_ven = @sCoVen
            WHERE co_tipo_doc = 'FACT' AND nro_doc = @sNroDoc
              AND co_cli = (SELECT co_cli FROM saFacturaVenta WHERE doc_num = @sNroDoc);
        END
        ELSE IF @sTipo = 'DEV'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM saDevolucionCliente WHERE doc_num = @sNroDoc)
                RAISERROR('Documento %s no encontrado', 16, 1, @sDocTrim);
            IF EXISTS (SELECT 1 FROM saDevolucionCliente WHERE doc_num = @sNroDoc AND anulado = 1)
                RAISERROR('Documento %s anulado', 16, 1, @sDocTrim);

            UPDATE saDevolucionCliente
            SET co_ven = @sCoVen, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
            WHERE doc_num = @sNroDoc;
        END
        ELSE
            RAISERROR('Tipo de documento invalido', 16, 1);

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

CREATE OR ALTER PROCEDURE [pApiRestaurarVendedorCliente]
    ( @sCoCli CHAR(16), @sCoVen CHAR(6), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sVenTrim VARCHAR(6)    = RTRIM(@sCoVen);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);
        -- Rollback only: the previous seller may have been deactivated since, so inactivo is not checked.
        IF NOT EXISTS (SELECT 1 FROM saVendedor WHERE co_ven = @sCoVen)
            RAISERROR('Vendedor %s no encontrado', 16, 1, @sVenTrim);

        UPDATE saCliente
        SET co_ven = @sCoVen, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
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
