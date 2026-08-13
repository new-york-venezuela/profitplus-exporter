# SP: pValidarChequesDevuelto
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [[pValidarChequeDevuelto]]
DESCRIPCION: Se encarga de validar si el cliente posee o no cheques devueltos  
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [pValidarChequesDevuelto] ( @sCodigo CHAR(16) )
AS 
    BEGIN		

        SELECT
            ISNULL(SUM(dv.saldo), 0) AS saldo, nro_doc
        FROM
            saDocumentoVenta dv
        WHERE
            saldo > 0
            AND dv.co_tipo_doc = 'CHEQ'
            AND dv.anulado = 0
            AND dv.co_cli = @sCodigo
        GROUP BY
            nro_doc, saldo
		    					 							    
    END
```
