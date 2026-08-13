# SP: pObetenerArticulosSegunFiltro
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObetenerArticulosSegunFiltro
*DESCRIPCIÓN	: Busca la lista de articulos segun los filtros indicados por sistema
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pObetenerArticulosSegunFiltro]
		(
			@sCo_Prov		CHAR(16)= NULL,
			@sLinea			CHAR(6) = NULL,
			@sSublinea		CHAR(6) = NULL,
			@sCategoria		CHAR(6) = NULL,
			@sColor			CHAR(6) = NULL
		)
AS 
    BEGIN	
		
		SELECT p.co_prov, a.* FROM saArticulo AS a
			LEFT JOIN saArtProveedorReng AS p ON a.co_art = p.co_art AND @sCo_Prov IS NOT NULL
		WHERE 
			((@sCo_Prov		IS		NULL)	OR		(@sCo_Prov = p.co_prov))		AND 
			((@sLinea		IS		NULL)	OR		(@sLinea = a.Co_lin))			AND
			((@sSublinea	IS		NULL)	OR		(@sSublinea = a.co_subl))		AND
			((@sCategoria	IS		NULL)	OR		(@sCategoria = a.co_cat))		AND
			((@sColor		IS		NULL)	OR		(@sColor = a.co_color)) 
    END
```
