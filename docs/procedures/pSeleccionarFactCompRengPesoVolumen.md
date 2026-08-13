# SP: pSeleccionarFactCompRengPesoVolumen
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pSeleccionarFactCompRengPesoVolumen
-- DESCRIPCIÓN:		Selecciona el peso y volumen del renglón de la factura de compra
-- AUTOR:			SOFTECH CONSULTORES
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarFactCompRengPesoVolumen]
	(	  
	  @gRowguidDoc UNIQUEIDENTIFIER	  
	)
AS
	BEGIN
		SELECT A.*, B.rowguid, B.reng_num, B.doc_num, B.co_art, C.art_des, B.co_uni, B.total_art
		FROM 
		saFactCompRengPesoVolumen A 
        RIGHT JOIN	 saFacturaCompraReng B ON B.rowguid = A.rowguidDoc
		LEFT JOIN	saArticulo C ON C.co_art = B.co_art
		
        WHERE            
            B.rowguid = @gRowguidDoc			
	END
```
