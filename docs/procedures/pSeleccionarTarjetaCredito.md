# SP: pSeleccionarTarjetaCredito
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarTarjetaCredito
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarTarjetaCredito] ( @sCo_Tar CHAR(6) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saTarjetaCredito
        WHERE
            co_tar = @sCo_Tar
    END
```
