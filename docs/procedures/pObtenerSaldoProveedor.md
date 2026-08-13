# SP: pObtenerSaldoProveedor
**Tipo**: Obtener
**Módulo**: Clientes

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerSaldoProveedor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS.
FECHA : 29-12-09
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO EL: 23/02/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerSaldoProveedor] ( @sCodigo CHAR(16) )
AS 
    BEGIN	

        DECLARE @deSaldo DECIMAL(18, 2)

        SELECT
            dbo.SaldoProveedorAUnaFecha(@sCodigo, NULL)

    END
```
