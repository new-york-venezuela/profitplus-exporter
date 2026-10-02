-- migrations/mssql/0012_pApiTipoPrecio.sql
CREATE OR ALTER PROCEDURE [pApiInsertarTipoPrecio]
    ( @sCoPrecio CHAR(6), @sDesPrecio VARCHAR(60), @sCoUsIn CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    IF EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
        RAISERROR('La lista de precio %s ya existe', 16, 1, @sTrim);
    INSERT INTO saTipoPrecio (co_precio, des_precio, incluye_imp, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid)
    VALUES (@sCoPrecio, @sDesPrecio, 0, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), NEWID());
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarTipoPrecio]
    ( @sCoPrecio CHAR(6), @sDesPrecio VARCHAR(60), @tsValidador BINARY(8), @sCoUsMo CHAR(6) )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    IF NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
        RAISERROR('Lista de precio %s no encontrada', 16, 1, @sTrim);
    UPDATE saTipoPrecio
    SET des_precio = @sDesPrecio, co_us_mo = @sCoUsMo, fe_us_mo = GETDATE()
    WHERE co_precio = @sCoPrecio AND validador = @tsValidador;
    SELECT @@ROWCOUNT AS updated;
END
GO
