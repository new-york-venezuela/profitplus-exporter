# SP: pObtenerRetencionValidarAntesEliminar
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:[pObtenerRetencionValidarAntesEliminar]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRetencionValidarAntesEliminar] ( @sNro_Doc VARCHAR(20) )
AS 
    BEGIN
       SELECT top 1
            ISNULL(E.cob_num, 0) AS cob_num
        FROM
            saPagoDocReng R
                     inner join saPago E on E.cob_num = R.cob_num
        WHERE
                     R.nro_doc = @sNro_Doc
            AND R.co_tipo_doc = 'N/CR'
                     AND E.anulado = 0
    END
```
