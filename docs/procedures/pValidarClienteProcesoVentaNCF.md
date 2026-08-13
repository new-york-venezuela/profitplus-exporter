# SP: pValidarClienteProcesoVentaNCF
**Tipo**: Validar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saClienteExt`](../tables/saClienteExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarClienteProcesoVentaNCF]
DESCRIPCION: Se encarga de validar si el cliente posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarClienteProcesoVentaNCF] ( @sCodigo CHAR(16) )
AS 
    BEGIN
        IF NOT EXISTS ( SELECT
                       cliExt.tComp, cliExt.n_cr, cliExt.n_db
                    FROM
                        saCliente cli INNER JOIN saClienteExt cliExt on cliExt.rowguid_cli = cli.rowguid
                    WHERE
                        cli.co_cli = @sCodigo) 
       SELECT
                'El cliente "' + RTRIM(@sCodigo) + '" no se encuentra configurado para el Proceso NCF.'

        SELECT
            ''
    END
```
