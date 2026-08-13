# SP: pSeleccionarProveedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarProveedor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarProveedor] ( @sCo_Prov CHAR(16) )
AS 
    BEGIN
        SELECT
            prov.*, ISNULL((SELECT provE.tgasto FROM saProveedorExt provE WHERE provE.rowguid_prov = prov.rowguid), NULL) AS Tgasto,
					ISNULL((SELECT provE.tComp FROM saProveedorExt provE WHERE provE.rowguid_prov = prov.rowguid), NULL) AS Tcomp

        FROM
            saProveedor prov
        WHERE
            prov.co_prov = @sCo_Prov
    END
```
