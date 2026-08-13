# SP: pObtenerComprobanteClienteNCF
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saClienteExt`](../tables/saClienteExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerComprobanteClienteNCF]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerComprobanteClienteNCF] ( @sCodigo CHAR(16) )
AS 
    BEGIN
        SELECT cliExt.tComp, cliExt.n_cr, cliExt.n_db
        FROM saCliente cli INNER JOIN saClienteExt cliExt on cliExt.rowguid_cli = cli.rowguid
        WHERE
                        cli.co_cli = @sCodigo
    END
```
