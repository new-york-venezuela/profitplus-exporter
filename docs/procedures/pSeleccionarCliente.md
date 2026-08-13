# SP: pSeleccionarCliente
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saClienteExt`](../tables/saClienteExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCliente
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCliente] ( @sCo_Cli CHAR(16) )
AS 
    BEGIN
        SELECT
            cli.*, ISNULL((SELECT cliE.n_cr FROM saClienteExt cliE WHERE cliE.rowguid_cli = cli.rowguid), NULL) AS N_CR,
				   ISNULL((SELECT cliE.n_db FROM saClienteExt cliE WHERE cliE.rowguid_cli = cli.rowguid), NULL) AS N_DB,
				   ISNULL((SELECT cliE.tComp FROM saClienteExt cliE WHERE cliE.rowguid_cli = cli.rowguid), NULL) AS TCOMP
        FROM
            saCliente cli
        WHERE
            cli.co_cli = @sCo_Cli
    END
```
