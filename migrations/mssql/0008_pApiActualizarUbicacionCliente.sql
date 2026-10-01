-- migrations/mssql/0008_pApiActualizarUbicacionCliente.sql
-- Updates ONLY a customer's location fields (campo1 = coordinates text,
-- dir_ent2 = delivery address). NULL parameter = leave that column
-- unchanged. Stamps saCliente's own modification audit columns
-- (co_us_mo / fe_us_mo) like Profit Plus's own editors do.
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'pApiActualizarUbicacionCliente')
    DROP PROCEDURE pApiActualizarUbicacionCliente;
GO

CREATE PROCEDURE [pApiActualizarUbicacionCliente]
    (
      @sCoCli   CHAR(16),
      @sCampo1  VARCHAR(60)  = NULL,
      @sDirEnt2 VARCHAR(MAX) = NULL,
      @sCoUsMo  CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM saCliente WHERE co_cli = @sCoCli)
        BEGIN
            RAISERROR('Cliente %s no encontrado', 16, 1, @sCoCli);
        END

        UPDATE saCliente
        SET campo1   = ISNULL(@sCampo1, campo1),
            dir_ent2 = ISNULL(@sDirEnt2, dir_ent2),
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
