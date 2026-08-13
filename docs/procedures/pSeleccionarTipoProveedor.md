# SP: pSeleccionarTipoProveedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTip_Pro
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTipoProveedor] ( @sTip_Pro CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTipoProveedor
        WHERE
            tip_pro = @sTip_Pro
    END
```
