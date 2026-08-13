# SP: pCalcularPesoFactCompReng
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pCalcularPesoFactCompReng
DESCRIPCION: Dado el rowguid de un renglón de factura de compra, devuelve el peso del renglón.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 19/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pCalcularPesoFactCompReng]
    (
      @rFact_Comp_Reng UNIQUEIDENTIFIER
    )
AS 
    BEGIN
	
        SELECT
			CASE ISNULL(FCRCA.peso_comp,0)
				WHEN 0 THEN A.peso * dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, 1)
				ELSE FCRCA.peso_comp * dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, 1)
			END AS Peso
		FROM 
			saFacturaCompraReng AS FCR
			LEFT JOIN saFactCompRengPesoVolumen AS FCRCA ON FCRCA.rowguidDoc = FCR.rowguid
			INNER JOIN saArticulo AS A ON A.co_art = FCR.co_art
		WHERE
			FCR.rowguid = @rFact_Comp_Reng
    END
```
