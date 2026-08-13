# SP: pObtenerPrecioFacturaVentaReng
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pObtenerPrecioFacturaVentaReng
*DESCRIPCIÓN	: Devuelve el precio del renglón asociado a una factura de venta.		
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerPrecioFacturaVentaReng]
	(
		@gRowGuid_Doc_Salida UNIQUEIDENTIFIER
    )
AS
	BEGIN
		SET NOCOUNT ON;

		DECLARE @t TABLE
		(
			Co_Art Char(30) ,
			Precio Decimal ,
			Unidad Char(6)
		)

		DECLARE @Co_Art Char(30)
		DECLARE @Precio Decimal
		DECLARE @Unidad Char(6)

		INSERT INTO @t
			( Co_Art, Precio, Unidad )
		SELECT
			co_art AS Co_Art, prec_vta AS Precio, co_uni AS Unidad
		FROM
			saFacturaVentaReng
		WHERE
			rowguid = @gRowGuid_Doc_Salida

		SET @Co_Art =
		(
			SELECT
				Co_Art
			FROM
				@t
		)

		SET @Precio =
		(
			SELECT
				Precio
			FROM
				@t
		)

		SET @Unidad =
		(
			SELECT
				Unidad
			FROM
				@t
		)

		EXEC [dbo].[pObtenerPrecioEnUnidadBase] @sCo_Art = @Co_Art, @sCod_Uni = @Unidad, @dePrecio = @Precio
	END
```
