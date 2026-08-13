# SP: pObtenerListaLineaSubLinea
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerLineaPorArticulo]
*DESCRIPCIÓN	: Sp que obtiene las lineas asociadas a un articulo dado
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2013-01-09
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerListaLineaSubLinea]
    (
      @sCo_art CHAR(30)
    )
AS 
    BEGIN	
			SELECT	'Grupo1' AS Grupo, s.co_lin AS Linea, l.lin_des AS DescripLinea, 
					s.co_subl AS SubLinea, s.subl_des AS DescripSubLinea
					FROM saArtCaracteristica C
						INNER JOIN saSubLinea S ON s.co_lin = C.co_lin01  
						INNER JOIN saLineaArticulo L ON l.co_lin =  s.co_lin
				WHERE co_art = @sCo_art
		UNION
			SELECT	'Grupo2' AS Grupo, s.co_lin AS Linea, l.lin_des AS DescripLinea, 
					s.co_subl AS SubLinea, s.subl_des AS DescripSubLinea
					FROM saArtCaracteristica C
						INNER JOIN saSubLinea S ON s.co_lin = C.co_lin02  
						INNER JOIN saLineaArticulo L ON l.co_lin =  s.co_lin
				WHERE co_art = @sCo_art
		UNION
			SELECT	'Grupo3' AS Grupo, s.co_lin AS Linea, l.lin_des AS DescripLinea, 
					s.co_subl AS SubLinea, s.subl_des AS DescripSubLinea
					FROM saArtCaracteristica C
						INNER JOIN saSubLinea S ON s.co_lin = C.co_lin03 
						INNER JOIN saLineaArticulo L ON l.co_lin =  s.co_lin
				WHERE co_art = @sCo_art
		UNION
			SELECT	'Grupo4' AS Grupo, s.co_lin AS Linea, l.lin_des AS DescripLinea, 
					s.co_subl AS SubLinea, s.subl_des AS DescripSubLinea
					FROM saArtCaracteristica C
						INNER JOIN saSubLinea S ON s.co_lin = C.co_lin04  
						INNER JOIN saLineaArticulo L ON l.co_lin =  s.co_lin
				WHERE co_art = @sCo_art
		UNION
			SELECT	'Grupo5' AS Grupo, s.co_lin AS Linea, l.lin_des AS DescripLinea, 
					s.co_subl AS SubLinea, s.subl_des AS DescripSubLinea
					FROM saArtCaracteristica C
						INNER JOIN saSubLinea S ON s.co_lin = C.co_lin05  
						INNER JOIN saLineaArticulo L ON l.co_lin =  s.co_lin
				WHERE co_art = @sCo_art
    END
```
