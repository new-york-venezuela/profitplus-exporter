# SP: RepCompPreciosdeArticulos
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMA>
-- Create date: <2015-07-17,,>
-- Description:	<RepCompPreciosdeArticulos,,>
-- LAST DATE:2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepCompPreciosdeArticulos] 
	-- Add the parameters for the stored procedure here
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@sCo_art CHAR(30) = NULL,
	@sCo_Precio1 CHAR(6) = NULL,
	@sCo_Precio2 CHAR(6) = NULL,
	@sCo_Precio3 CHAR(6) = NULL,
	@sCo_Almacen CHAR(6) = NULL,
	@sCo_Escala CHAR (10) = NULL,
	@sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6) = NULL ,
	@bHeaderRep BIT = 0

AS
BEGIN
	DECLARE @MyTableVar table(
    Co_art CHAR(30),
    monto DECIMAL (18,2),
    desde SMALLDATETIME,
    column1 CHAR (10),
	co_precio CHAR (6),
	des_precio VARCHAR (60),
	art_des VARCHAR(120)); 
	SET NOCOUNT ON;

	IF (@sCo_Precio1 IS NULL AND @sCo_Precio2 IS NULL AND @sCo_Precio3 IS  NULL)    
        BEGIN
			RAISERROR('No es posible ejecutar el reporte, debe seleccionar un Tipo de Precio.',16,1);
			RETURN
		END 

	IF (@sCo_art IS NULL )
		BEGIN
			RAISERROR ('Debe seleccionar un artículo.',16,1)
			RETURN
		END

	IF (@sCo_Almacen IS NULL AND EXISTS (select * from @MyTableVar B where B.co_precio = @sCo_Precio1)) 
		BEGIN
			RAISERROR ('Debe seleccionar un Almacén.',16,1)
			RETURN
		END 

	IF (@sCo_Escala IS NULL) 
		BEGIN
		SET @sCO_Escala = '1'  
		END
	


	insert into @MyTableVar
	SELECT     dbo.saArticulo.co_art, 

	round(dbo.saArtPrecio.monto * [dbo].[TasaAUnaFecha](dbo.saArtPrecio.co_mone, 1, dbo.saArtPrecio.desde),5)  as monto, 
				dbo.saArtPrecio.desde, @sCo_Escala,dbo.saTipoPrecio.co_precio, dbo.saTipoPrecio.des_precio, 
				dbo.saArticulo.art_des
	 FROM       dbo.saArticulo INNER JOIN
                dbo.saArtPrecio ON dbo.saArticulo.co_art = dbo.saArtPrecio.co_art INNER JOIN
                dbo.saTipoPrecio ON dbo.saArtPrecio.co_precio = dbo.saTipoPrecio.co_precio
	 WHERE (saArtPrecio.desde >= @dFecha_d AND @dFecha_d <= @dFecha_h) AND
		   (saArticulo.co_art = @sCo_art ) AND
		   (saArtPrecio.Co_Precio = @sCo_Precio1 OR saArtPrecio.Co_Precio = @sCo_Precio2 OR saArtPrecio.Co_Precio = @sCo_Precio3) AND (saArtPrecio.co_alma = @sCo_Almacen OR saArtPrecio.co_alma_calculado = 'TODOS')


	IF @sCo_Precio1 is not null AND exists (select * from @MyTableVar B where B.co_precio = @sCo_Precio1)
	BEGIN 
		IF not exists (
```
