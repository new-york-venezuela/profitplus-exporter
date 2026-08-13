# SP: pSeleccionarTipoCliente
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE: pSeleccionarTipoCliente
*DESCRIPCION: Selecciona los campos de la tabla  tipo_cli segun su PK
*CREADO POR: SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pSeleccionarTipoCliente] ( @sTip_Cli CHAR(6) )
AS 
    BEGIN
		
        SELECT
            *
        FROM
            saTipoCliente
        WHERE
            tip_cli = @sTip_Cli

    END
```
