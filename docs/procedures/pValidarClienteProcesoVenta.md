# SP: pValidarClienteProcesoVenta
**Tipo**: Validar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarFacturasVencidasCliente]
DESCRIPCION: Se encarga de validar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [pValidarClienteProcesoVenta] ( @sCodigo CHAR(16) )
AS 
    BEGIN
        IF EXISTS ( SELECT
                        C.co_cli
                    FROM
                        saCliente C
                    WHERE
                        C.co_cli = @sCodigo
                        AND C.inactivo = 1 ) 
            SELECT
                'El cliente "' + RTRIM(@sCodigo) + '" se encuentra inactivo.'

        SELECT
            ''
    END
```
