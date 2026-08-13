# SP: pSeleccionarPlantillaCompra
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarCompra
DESCRIPCION		: Selecciona un registro de la tabla saPlantillaCompra segun su primary key
CREADO POR		: SOFTECH SISTEMAS
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarPlantillaCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred
        FROM
            saPlantillaCompra fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
        WHERE
            doc_num = @sDoc_Num
    END
```
