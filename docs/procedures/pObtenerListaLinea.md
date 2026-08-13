# SP: pObtenerListaLinea
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerLineaPorArticulo]
*DESCRIPCIÓN	: Sp que obtiene las lineas asociadas a un articulo dado
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2013-01-09
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerListaLinea]
    (
      @sCo_art CHAR(30)
    )
AS 
    BEGIN	
   
			SELECT	 co_lin01 AS Linea, l.lin_des AS DescripLinea 
					FROM saArtCaracteristica 
						INNER JOIN saLineaArticulo L ON l.co_lin =  co_lin01
				WHERE co_art = @sCo_art
		UNION
		SELECT	 co_lin02 AS Linea, l.lin_des AS DescripLinea 
					FROM saArtCaracteristica 
						INNER JOIN saLineaArticulo L ON l.co_lin =  co_lin02
				WHERE co_art = @sCo_art
		UNION
		SELECT	 co_lin03 AS Linea, l.lin_des AS DescripLinea 
					FROM saArtCaracteristica 
						INNER JOIN saLineaArticulo L ON l.co_lin =  co_lin03
				WHERE co_art = @sCo_art
		UNION
		SELECT	 co_lin04 AS Linea, l.lin_des AS DescripLinea 
					FROM saArtCaracteristica 
						INNER JOIN saLineaArticulo L ON l.co_lin =  co_lin04
				WHERE co_art = @sCo_art
		UNION
		SELECT	 co_lin05 AS Linea, l.lin_des AS DescripLinea 
					FROM saArtCaracteristica 
						INNER JOIN saLineaArticulo L ON l.co_lin =  co_lin05
				WHERE co_art = @sCo_art
    END
```
