# SP: pSeleccionarVendedor
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarVendedor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarVendedor] ( @sCo_Ven CHAR(6) )
AS 
    BEGIN

        SELECT
            *
        FROM
            saVendedor
        WHERE
            co_ven = @sCo_Ven

    END
```
