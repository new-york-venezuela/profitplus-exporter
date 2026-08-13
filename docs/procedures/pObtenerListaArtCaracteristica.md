# SP: pObtenerListaArtCaracteristica
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerListaArtCaracteristicaMov]
*DESCRIPCIÓN	: Sp que obtiene las llista de movimientos dado un tipo de documento y su
				  respectivo rowguid
*AUTOR			: SOFTECH SISTEMAS
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerListaArtCaracteristica]
    (
      @sCo_art CHAR(30)
    )

AS 
    BEGIN	
    
			SELECT	 co_lin01 AS Linea01, l.lin_des AS DescripLinea01, co_lin02 AS Linea02, m.lin_des AS DescripLinea02, 
					 co_lin03 AS Linea03, o.lin_des AS DescripLinea03, co_lin04 AS Linea04, p.lin_des AS DescripLinea04,
					 co_lin05 AS Linea05, q.lin_des AS DescripLinea05  
					FROM saArtCaracteristica 
						LEFT JOIN saLineaArticulo L ON l.co_lin =  co_lin01
						LEFT JOIN saLineaArticulo M ON m.co_lin =  co_lin02
						LEFT JOIN saLineaArticulo o ON o.co_lin =  co_lin03
						LEFT JOIN saLineaArticulo p ON p.co_lin =  co_lin04
						LEFT JOIN saLineaArticulo q ON q.co_lin =  co_lin05
						
				WHERE co_art = @sCo_art

    END
```
