-- migrations/mssql/0017_pApi_customer_mapping_fixes.sql
-- Supersedes the 0016 behavior of pApiCorregirVendedorDocumento (0016 was already applied,
-- so it is not edited in place):
--  * DEV (customer return): the saDocumentoVenta credit-note ledger mirror is REMOVED. A credit
--    note has its own number (linked via doc_orig/nro_orig), so matching the return's doc_num
--    could modify another customer's credit note.
--  * FACT: the ledger mirror is kept but guarded by the invoice's customer (co_cli).
-- Adds pApiRestaurarVendedorCliente, used only by `mapping:apply --rollback`: it accepts a
-- seller that has been deactivated since the run (pApiActualizarVendedorCliente refuses those).

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
