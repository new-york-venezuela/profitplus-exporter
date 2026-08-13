# SP: pValidarChequesDevueltoCompra
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarChequesDevueltoCompra]
DESCRIPCION: Se encarga de validar si el proveedor posee o no cheques devueltos  
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 28-02-2011
***************************************************************************************************************/
CREATE PROCEDURE [pValidarChequesDevueltoCompra] ( @sCodigo CHAR(16) )
AS 
    BEGIN		

        SELECT
            ISNULL(SUM(DC.saldo), 0) AS saldo, nro_doc
        FROM
            saDocumentoCompra DC
        WHERE
            saldo > 0
            AND DC.co_tipo_doc = 'CHEQ'
            AND DC.anulado = 0
            AND DC.co_Prov = @sCodigo
        GROUP BY
            nro_doc, saldo
		    					 							    
    END
```
