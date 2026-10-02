-- migrations/mssql/0010_pApiActualizarTipoCliente.sql
-- Renames and/or repoints a customer type (segment): changes ONLY des_tipo and/or
-- co_precio of saTipoCliente. Optimistic concurrency on `validador`: returns
-- updated = 0 when the row changed since it was read. Stamps co_us_mo / fe_us_mo.
CREATE OR ALTER PROCEDURE [pApiActualizarTipoCliente]
    (
      @sTipCli      CHAR(6),
      @sDesTipo     VARCHAR(60) = NULL,
      @sCoPrecio    CHAR(6)     = NULL,
      @tsValidador  BINARY(8),
      @sCoUsMo      CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRAN;

        DECLARE @sTipCliTrim   VARCHAR(6) = RTRIM(@sTipCli);
        DECLARE @sCoPrecioTrim VARCHAR(6) = RTRIM(@sCoPrecio);
        DECLARE @n INT;

        IF NOT EXISTS (SELECT 1 FROM saTipoCliente WHERE tip_cli = @sTipCli)
            RAISERROR('Tipo de cliente %s no encontrado', 16, 1, @sTipCliTrim);

        IF @sCoPrecio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
            RAISERROR('Lista de precio %s no encontrada', 16, 1, @sCoPrecioTrim);

        UPDATE saTipoCliente
        SET des_tipo  = COALESCE(@sDesTipo, des_tipo),
            co_precio = COALESCE(@sCoPrecio, co_precio),
            co_us_mo  = @sCoUsMo,
            fe_us_mo  = GETDATE()
        WHERE tip_cli = @sTipCli AND validador = @tsValidador;
        SET @n = @@ROWCOUNT;

        COMMIT TRAN;
        SELECT @n AS updated;
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
