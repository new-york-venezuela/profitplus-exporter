# SP: pv_ObtenerTipoPerCliente
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pv_ObtenerTipoPerCliente
*DESCRIPCIÓN	:	obtiene campo tipo_per de la tabla saCliente
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pv_ObtenerTipoPerCliente]
    (
      @sCo_Cli CHAR(16) 
    )
AS 
    BEGIN
	
        SELECT tipo_per 

		FROM saCliente

		WHERE 
			co_cli = @sCo_Cli


    END
```
