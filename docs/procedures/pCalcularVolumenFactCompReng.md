# SP: pCalcularVolumenFactCompReng
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pCalcularVolumenFactCompReng
DESCRIPCION: Dado el rowguid de un renglón de factura de compra, devuelve el volumen del renglón.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 19/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pCalcularVolumenFactCompReng]
    (
      @rFact_Comp_Reng UNIQUEIDENTIFIER
    )
AS 
    BEGIN
	
        SELECT
			CASE ISNULL(FCRCA.volumen_comp,0)
				WHEN 0 THEN A.volumen * dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, 1)
				ELSE FCRCA.volumen_comp * dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, 1)
			END AS Volumen
		FROM 
			saFacturaCompraReng AS FCR
			LEFT JOIN saFactCompRengPesoVolumen AS FCRCA ON FCRCA.rowguidDoc = FCR.rowguid
			INNER JOIN saArticulo AS A ON A.co_art = FCR.co_art
		WHERE
			FCR.rowguid = @rFact_Comp_Reng
    END
```
