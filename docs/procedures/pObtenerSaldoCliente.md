# SP: pObtenerSaldoCliente
**Tipo**: Obtener
**Módulo**: Clientes

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerSaldoProveedor
DESCRIPCION: Se encarga de obtener el saldo de 
CREADO POR: SOFTECH SISTEMAS.
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO EL: 24/02/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerSaldoCliente] ( @sCodigo CHAR(16) )
AS 
    BEGIN		
        SELECT
            dbo.SaldoClienteAUnaFecha(@sCodigo, NULL)

    END
```
