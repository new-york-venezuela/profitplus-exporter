# SP: pObtenerComprobanteProveedorNCF
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerComprobanteProveedorNCF]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
CREAD EL: 23/07/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerComprobanteProveedorNCF] ( @sCodigo CHAR(16) )
AS 
    BEGIN
        SELECT proExt.tComp, proExt.tgasto
        FROM saProveedor pro INNER JOIN saProveedorExt proExt on proExt.rowguid_prov = pro.rowguid
        WHERE
              pro.co_prov = @sCodigo
    END
```
