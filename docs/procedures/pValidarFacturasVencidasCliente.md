# SP: pValidarFacturasVencidasCliente
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarFacturasVencidasCliente]
DESCRIPCION: Se encarga de validar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarFacturasVencidasCliente]
    (
      @sCodigo CHAR(16) ,
      @sdFecha SMALLDATETIME
    )
AS 
    BEGIN		

        SELECT
            ISNULL(SUM(dv.saldo), 0) AS saldo, nro_doc
        FROM
            saDocumentoVenta dv
        WHERE
            dv.co_tipo_doc = 'FACT'
            AND dv.anulado = 0
            AND dv.co_cli = @sCodigo
            AND dv.fec_venc < @sdFecha
        GROUP BY
            nro_doc, saldo						 							    
		HAVING      (saldo > 0)
    END
```
