# SP: pObtenerArticuloPesoVolumenFactCompra
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pObtenerArticuloPesoVolumenFactCompra
-- DESCRIPCIÓN:		Obtiene el Peso y Volumen del Articulo del Renglon de la Factura de Compra
-- AUTOR:			SOFTECH CONSULTORES
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerArticuloPesoVolumenFactCompra]
	(	  
	  @sCo_Art CHAR(30)
	)
AS
	BEGIN
		SELECT A.co_art, A.art_des, A.volumen, A.peso
		FROM 
		saArticulo A         
        WHERE            
            A.co_art = @sCo_Art			
	END
```
