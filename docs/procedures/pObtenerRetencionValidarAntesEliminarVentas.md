# SP: pObtenerRetencionValidarAntesEliminarVentas
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:[pObtenerRetencionValidarAntesEliminarVentas]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRetencionValidarAntesEliminarVentas] ( @sNro_Doc VARCHAR(20) )
AS 
    BEGIN
        SELECT top 1
            ISNULL(E.cob_num, 0) AS cob_num
        FROM
            saCobroDocReng R
                     inner join saCobro E on E.cob_num = R.cob_num
        WHERE
                     R.nro_doc = @sNro_Doc
            AND R.co_tipo_doc = 'N/CR'
                     AND E.anulado = 0
    END
```
