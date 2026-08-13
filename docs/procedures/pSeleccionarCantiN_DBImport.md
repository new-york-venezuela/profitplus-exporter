# SP: pSeleccionarCantiN/DBImport
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarCantiN/DBImport] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            COUNT(DISTINCT ( DVR.nro_doc )) AS canti
        FROM
            saDocumentoVentaReng DVR
        WHERE
            nro_doc = @sDoc_Num
			AND co_tipo_doc = 'N/DB'
    END
```
