# SP: pObtenerPrecioPermitidos
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`pvConfigPuntoV`](../tables/pvConfigPuntoV.md)
- [`pvConfigPuntoVPrecio`](../tables/pvConfigPuntoVPrecio.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerPrecioPermitidos
*DESCRIPCIÓN	: Devuelve los tipos de precio que puede utilizar un usuario.
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerPrecioPermitidos]
    (
      @sCoUsuario CHAR(6) ,
      @sCoMapa CHAR(6)
    )
AS 

DECLARE @COUNT INT
		
    BEGIN	
	
		select @COUNT=count(*)
		from pvConfigPuntoV
			inner join pvConfigPuntoVPrecio on pvConfigPuntoVPrecio.co_config = pvConfigPuntoV.co_config
		where co_usuario=@sCoUsuario
		
		if ( @COUNT > 0 )
			BEGIN
				select co_usuario, co_mapa, pvConfigPuntoVPrecio.co_precio, saTipoPrecio.des_precio
				from pvConfigPuntoVPrecio 
					inner join pvConfigPuntoV on pvConfigPuntoVPrecio.co_config = pvConfigPuntoV.co_config
					inner join saTipoPrecio on pvConfigPuntoVPrecio.co_precio = saTipoPrecio.co_precio
				where co_usuario=@sCoUsuario
			end
		else
			BEGIN
				select co_usuario, co_mapa, pvConfigPuntoVPrecio.co_precio, saTipoPrecio.des_precio
				from pvConfigPuntoVPrecio 
					inner join pvConfigPuntoV on pvConfigPuntoVPrecio.co_config = pvConfigPuntoV.co_config
					inner join saTipoPrecio on pvConfigPuntoVPrecio.co_precio = saTipoPrecio.co_precio
				where co_mapa=@sCoMapa
			end
    END
```
