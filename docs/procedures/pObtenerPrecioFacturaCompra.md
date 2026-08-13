# SP: pObtenerPrecioFacturaCompra
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerPrecioFacturaCompra]
    (
      @strNum_Doc CHAR(20), 
      @strTipo_Precio CHAR(6), ---'Todos' si no selecciona ninguno
	  @strAlmacen CHAR(10), --'Todos', 'Documento' o un código de almacen valido
	  @strCosto bit,  --0 para Promedio, 1 para Documento
	  @strMargen CHAR(6), --'Mínimo', 'Máximo' u 'Otro'
	  @strMargenOtro decimal(18, 5), --Si selecciona Otro en el costo
	  @strUsuario CHAR(6),
      @strMaquina CHAR(60),
      @strCoSucu CHAR(6)= NULL,
	  @bTipo Bit,  
	  @CostoPrecio Bit, -- 1 para costo a precio, 0 para precio a costo
	  @Desde DateTime,
	  @Hasta DateTime = NULL --Puede ser nulo 
    )
AS 
    BEGIN

        SET NOCOUNT ON
	
        DECLARE @ArticuloActual                 AS UNIQUEIDENTIFIER
        DECLARE @AlmacenActual                  AS CHAR(6)
        DECLARE @StockActual                    AS DECIMAL(18, 5)
        DECLARE @StockProcesarActual            AS DECIMAL(18, 5)
        DECLARE @CostoPromedioActual            AS DECIMAL(18, 5)
		DECLARE @sCoArticulo                    AS CHAR (6) 

--------------------------------------------------------------------------------------------------------------------------------------------------------------

	DECLARE RENGLONES_FACTURA CURSOR LOCAL FAST_FORWARD
			FOR
				SELECT rowguid from saFacturaCompraReng where doc_num = @strNum_Doc

	OPEN RENGLONES_FACTURA

	DECLARE @pRowguid uniqueidentifier

	FETCH NEXT FROM RENGLONES_FACTURA INTO @pRowguid

	WHILE @@FETCH_STATUS = 0 
	Begin
		   --insert into @TablaMovimientoInventario 
			   EXEC [pCostoPromedioCalcularRenglonAprox] @strUsuario = @strUsuario, @strMaquina =@strMaquina, @strCoSucu = @strCoSucu,
					@RowGuid_Doc_Orig = @pRowguid, @bTipo = @bTipo

		   FETCH NEXT FROM RENGLONES_FACTURA INTO @pRowguid

	End
	
	CLOSE RENGLONES_FACTURA
	DEALLOCATE RENGLONES_FACTURA

	--CoAlma
	--(CASE @strAlmacen WHEN 'Documento' THEN (SELECT TOP (1) co_alma FROM saFacturaCompraReng WHERE doc_num = @strNum_Doc AND co_art = saFacturaCompraReng.co_art) END)


SELECT  dbo.saFacturaCompraReng.reng_num as Renglon_num, dbo.saFacturaCompraReng.co_art as Co_art, dbo.saArticulo.art_des as Art_des, 
						CASE @strCosto
							WHEN  0 THEN
								(SELECT TOP(1) ISNULL(CHE.costo_pro, 0) costo_pro 
								FROM saFacturaCompraReng AS fcr INNER JOIN saArticulo AS AT ON fcr.co_art = AT.co_art INNER JOIN saArtUnidad AS AU ON AT.co_art = AU.co_art AND AU.uni_principal = 1
```
