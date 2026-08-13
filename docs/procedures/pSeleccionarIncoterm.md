# SP: pSeleccionarIncoterm
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarIncoterm
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarIncoterm] ( @sCo_Incoterm CHAR(30) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saIncoterm
        WHERE
            co_Incoterm = @sCo_Incoterm
    END
```
