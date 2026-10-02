-- migrations/mssql/0009_pApiActualizarVendedorCliente.sql
-- Changes ONLY a customer's assigned seller (saCliente.co_ven). Only an
-- existing, active (saVendedor.inactivo = 0) seller is accepted. Stamps
-- saCliente's own modification audit columns (co_us_mo / fe_us_mo) like
-- Profit Plus's own editors do. Manual, user-initiated changes only.
CREATE OR ALTER PROCEDURE [pApiActualizarVendedorCliente]
    (
      @sCoCli  CHAR(16),
      @sCoVen  CHAR(6),
      @sCoUsMo CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        DECLARE @sCoCliTrim VARCHAR(16) = RTRIM(@sCoCli);
        DECLARE @sCoVenTrim VARCHAR(6)  = RTRIM(@sCoVen);

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCliTrim);

        IF NOT EXISTS (SELECT 1 FROM saVendedor WHERE co_ven = @sCoVen AND inactivo = 0)
            RAISERROR('Vendedor %s no encontrado o inactivo', 16, 1, @sCoVenTrim);

        UPDATE saCliente
        SET co_ven   = @sCoVen,
            co_us_mo = @sCoUsMo,
            fe_us_mo = GETDATE()
        WHERE co_cli = @sCoCli;

        COMMIT TRAN;
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
