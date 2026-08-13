# SP: pvSeleccionarTarjetaCreditoExt
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTarjetaCreditoExt`](../tables/pvTarjetaCreditoExt.md)
- [`pvTipoTarjeta`](../tables/pvTipoTarjeta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvSeleccionarTarjetaCreditoExt
*DESCRIPCIÓN	: Seleccionar un tipo de Tarjeta 
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvSeleccionarTarjetaCreditoExt] (@growguid_co_tar UNIQUEIDENTIFIER)
AS 
    BEGIN
        SELECT
            b.TipoTarjeta,a.*
        FROM
            pvTarjetaCreditoExt AS a INNER JOIN pvTipoTarjeta AS b ON a.rowguid_co_tipo_tar = b.rowguid
        WHERE
            a.rowguid_co_tar = @growguid_co_tar
    END
```
