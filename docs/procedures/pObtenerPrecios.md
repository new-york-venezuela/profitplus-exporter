# SP: pObtenerPrecios
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS - 
 Create date:   <08-02-11>
 Description:	<Descuento por Articulo>
 =============================================*/
CREATE PROCEDURE [dbo].[pObtenerPrecios]
	-- Add the parameters for the stored procedure here
    @sCoArticulo CHAR(30) ,
    @sCoAlmacen CHAR(6)
AS 
    BEGIN

        SELECT [saArtPrecio].[rowguid]
			  ,[desde]
			  ,[hasta]
			  ,[monto]
			  ,[des_precio] as [co_precio]
		  FROM [saArtPrecio] inner join [saTipoPrecio] on [saTipoPrecio].[co_precio] = [saArtPrecio].[co_precio]
		  where co_art = @sCoArticulo and
				( hasta is NULL or hasta >= getdate() ) and
				( co_alma_calculado = 'TODOS' or co_alma_calculado = @sCoAlmacen ) 
		  order by [co_precio], [desde]



    END
```
