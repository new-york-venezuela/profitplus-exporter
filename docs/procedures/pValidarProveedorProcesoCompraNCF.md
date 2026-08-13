# SP: pValidarProveedorProcesoCompraNCF
**Tipo**: Validar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pValidarProveedorProcesoCompraNCF]
DESCRIPCION: Se encarga de validar si el Proveedor posee o no facturas vencidas a una fecha 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarProveedorProcesoCompraNCF] ( @sCodigo CHAR(16) )
AS 
    BEGIN
        IF NOT EXISTS ( SELECT
                       proExt.tComp, proExt.tgasto
                    FROM
                        saProveedor pro INNER JOIN saProveedorExt proExt on proExt.rowguid_prov = pro.rowguid
                    WHERE
                        pro.co_prov = @sCodigo) 
       SELECT
                'El proveedor "' + RTRIM(@sCodigo) + '" no se encuentra configurado para el Proceso NCF.'

        SELECT
            ''
    END
```
