# SP: pSeleccionarCotizacionProveedor
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarCotizacionProveedor
DESCRIPCION		: Selecciona un registro de la tabla saCotizacionProveedor segun su primary key
CREADO POR		: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCotizacionProveedor] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred
        FROM
            saCotizacionProveedor fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
        WHERE
            doc_num = @sDoc_Num

    END
```
