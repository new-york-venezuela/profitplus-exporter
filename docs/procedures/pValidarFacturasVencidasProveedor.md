# SP: pValidarFacturasVencidasProveedor
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarFacturasVencidasProveedor]
DESCRIPCION: Se encarga de validar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 28-02-2011
***************************************************************************************************************/
CREATE PROCEDURE [pValidarFacturasVencidasProveedor]
    (
      @sCodigo CHAR(16) ,
      @sdFecha SMALLDATETIME
    )
AS 
    BEGIN		

        SELECT
            ISNULL(SUM(DC.saldo), 0) AS saldo, nro_doc
        FROM
            saDocumentoCompra DC
        WHERE
            DC.co_tipo_doc = 'FACT'
            AND DC.anulado = 0
            AND DC.Co_Prov = @sCodigo
            AND DC.fec_venc < @sdFecha
        GROUP BY
            nro_doc, saldo						 							    

    END
```
