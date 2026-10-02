-- migrations/mssql/0014_pApi_hasta_end_of_day.sql
-- Profit's price lookups use "hasta IS NULL OR hasta >= GETDATE()", so a `hasta` stored at 00:00
-- of the last day expires the price at the START of that day. Every `hasta` written by the app is
-- now END OF DAY (23:59:59.997); `desde` stays at midnight. Rows written by Profit's own UI may
-- carry a time-of-day in `desde`, so rows are located / de-duplicated by the DATE of `desde`.

CREATE OR ALTER PROCEDURE [pApiInsertarPrecioArticulo]
    (
      @sCoArt    CHAR(30),
      @sCoPrecio CHAR(6),
      @sCoAlma   CHAR(6)       = NULL,
      @sDesde    CHAR(10),
      @sHasta    CHAR(10)      = NULL,
      @deMonto   DECIMAL(18,5),
      @sCoMone   CHAR(6)       = NULL,
      @sCoUsIn   CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @sArtTrim VARCHAR(30) = RTRIM(@sCoArt);
    DECLARE @sPrecioTrim VARCHAR(6) = RTRIM(@sCoPrecio);
    DECLARE @sAlmaTrim VARCHAR(6) = RTRIM(@sCoAlma);

    IF NOT EXISTS (SELECT 1 FROM saArticulo WHERE co_art = @sCoArt)
    BEGIN RAISERROR('Artículo %s no encontrado', 16, 1, @sArtTrim); RETURN; END
    IF NOT EXISTS (SELECT 1 FROM saTipoPrecio WHERE co_precio = @sCoPrecio)
    BEGIN RAISERROR('Lista de precio %s no encontrada', 16, 1, @sPrecioTrim); RETURN; END
    IF @sCoAlma IS NOT NULL AND NOT EXISTS (SELECT 1 FROM saAlmacen WHERE co_alma = @sCoAlma)
    BEGIN RAISERROR('Almacén %s no encontrado', 16, 1, @sAlmaTrim); RETURN; END
    IF @deMonto <= 0
    BEGIN RAISERROR('El monto debe ser mayor que cero', 16, 1); RETURN; END

    DECLARE @dDesde DATETIME = CONVERT(DATETIME, @sDesde, 120);
    DECLARE @dHasta DATETIME = CASE WHEN @sHasta IS NULL THEN NULL
                                    ELSE DATEADD(MILLISECOND, -3, DATEADD(DAY, 1, CONVERT(DATETIME, @sHasta, 120))) END;
    IF @dHasta IS NOT NULL AND @dHasta < @dDesde
    BEGIN RAISERROR('La fecha final no puede ser anterior a la inicial', 16, 1); RETURN; END

    IF EXISTS (SELECT 1 FROM saArtPrecio
               WHERE co_art = @sCoArt AND co_precio = @sCoPrecio
                 AND co_alma_calculado = COALESCE(@sCoAlma, 'TODOS') AND CONVERT(DATE, desde) = CONVERT(DATE, @dDesde))
    BEGIN RAISERROR('Ya existe una tarifa que inicia en esa fecha', 16, 1); RETURN; END

    INSERT INTO saArtPrecio (co_art, co_precio, desde, hasta, co_alma, monto, precioOm, co_us_in, fe_us_in, co_us_mo, fe_us_mo, co_mone)
    VALUES (@sCoArt, @sCoPrecio, @dDesde, @dHasta, @sCoAlma, @deMonto, 0, @sCoUsIn, GETDATE(), @sCoUsIn, GETDATE(), @sCoMone);
END
GO

CREATE OR ALTER PROCEDURE [pApiActualizarPrecioArticulo]
    (
      @sCoArt      CHAR(30),
      @sCoPrecio   CHAR(6),
      @sCoAlma     CHAR(6)       = NULL,
      @sDesdeOri   CHAR(10),
      @sDesde      CHAR(10)      = NULL,
      @sHasta      CHAR(10)      = NULL,
      @bSetHasta   BIT           = 0,
      @deMonto     DECIMAL(18,5) = NULL,
      @tsValidador BINARY(8),
      @sCoUsMo     CHAR(6)
    )
AS
BEGIN
    SET NOCOUNT ON;
    IF @deMonto IS NOT NULL AND @deMonto <= 0
    BEGIN RAISERROR('El monto debe ser mayor que cero', 16, 1); RETURN; END

    UPDATE saArtPrecio
    SET desde    = COALESCE(CASE WHEN @sDesde IS NULL THEN NULL ELSE CONVERT(DATETIME, @sDesde, 120) END, desde),
        hasta    = CASE WHEN @bSetHasta = 1
                        THEN (CASE WHEN @sHasta IS NULL THEN NULL
                                   ELSE DATEADD(MILLISECOND, -3, DATEADD(DAY, 1, CONVERT(DATETIME, @sHasta, 120))) END)
                        ELSE hasta END,
        monto    = COALESCE(@deMonto, monto),
        co_us_mo = @sCoUsMo,
        fe_us_mo = GETDATE()
    WHERE co_art = @sCoArt AND co_precio = @sCoPrecio
      AND co_alma_calculado = COALESCE(@sCoAlma, 'TODOS')
      AND CONVERT(DATE, desde) = CONVERT(DATE, CONVERT(DATETIME, @sDesdeOri, 120))
      AND validador = @tsValidador;

    SELECT @@ROWCOUNT AS updated;
END
GO
