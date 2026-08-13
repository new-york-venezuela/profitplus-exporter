# SP: pSeleccionarGiroVenta
**Tipo**: Seleccionar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saGiroVenta`](../tables/saGiroVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarGiroVenta
DESCRIPCION	: Selleciona un registro de la tabla saGiroVenta segun su codigo
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarGiroVenta] ( @sCo_Giro CHAR(20) )
AS 
    BEGIN
        SELECT
            G.*, V.ven_des
        FROM
            saGiroVenta G
            INNER JOIN saVendedor V ON G.co_ven = V.co_ven
        WHERE
            G.co_giro = @sCo_Giro
	
    END
```
