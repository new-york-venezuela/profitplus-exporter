# SP: pValidarLoteStock
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarLoteStock]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(512) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                LE.rowguid, LE.tipo_doc, LE.numero_lote, LE.co_Art, LE.co_alma, LE.cantidad, LE.stock_actual,
                ISNULL(SUM(ls.cantidad), 0) AS usado, LE.numero_lote
            FROM
                saLoteEntrada LE
                LEFT JOIN saLoteSalida LS ON LE.rowguid = LS.rowguid_lote
            GROUP BY
                LE.rowguid, LE.tipo_doc, LE.numero_lote, LE.co_Art, LE.co_alma, LE.cantidad, LE.stock_actual
            HAVING
                LE.cantidad - LE.stock_actual <> ISNULL(SUM(ls.cantidad), 0)


        OPEN CURSOR_VALIDAR

        DECLARE @pMotivo VARCHAR(512)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
	
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pTipo_Doc CHAR(4)
        DECLARE @pNumeroLote CHAR(20)
        DECLARE @CoArt AS CHAR(30)
        DECLARE @CoAlma AS CHAR(6)
        DECLARE @Cantidad DECIMAL(18, 5)
        DECLARE @StockActual DECIMAL(18, 5)
        DECLARE @CantidadUsada DECIMAL(18, 5)
        DECLARE @NuevoStock DECIMAL(18, 5)
        DECLARE @NumLote CHAR(20)
	
        FETCH NEXT FROM CURSOR_VALIDAR INTO @Id, @pTipo_Doc, @pNumeroLote, @CoArt, @CoAlma, @Cantidad, @StockActual,
            @CantidadUsada, @NumLote

        WHILE @@FETCH_STATUS = 0 
            BEGIN
		--Set @PistaMensaje = 'El stock del lote de entrada "' + rtrim(@NumLote) + '" correspondiente al tipo de documento "' + @pTipo_Doc + '", articulo "' + rtrim(@CoArt) + '", almacen "' + rtrim(@CoAlma) + '" tiene como stock actual "' + ltrim(rtrim(CONVERT(varchar,@StockActual))) + '" y el correcto es "' + ltrim(rtrim(CONVERT(varchar,@Cantidad - @CantidadUsada))) + '"' 
                SET @PistaMensaje = 'El stock del lote de entrada "' + RTRIM(@NumLote)
                    + '" correspondiente al tipo de documento "' + @pTipo_Doc + '", articulo "' + RTRIM(@CoArt)
                    + '", tiene como stock actual "' + LTRIM(RTRIM(CONVERT(VARCHAR, @StockActual)))
                    + '" y el correcto es "' + LTRIM(RTRIM(CONVERT(VARCHAR, @Cantidad - @CantidadUsada))) + '"' 
					-- kdc: sit. #105763
					+ '", Co_Alma: "' + L
```
