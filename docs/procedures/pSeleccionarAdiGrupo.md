# SP: pSeleccionarAdiGrupo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiGrupo`](../tables/saAdiGrupo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pSeleccionarAdiGrupo
*DESCRIPCIÓN	: Actualiza un grupo adicional
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-08-19
**************************************************************************/
CREATE PROCEDURE [pSeleccionarAdiGrupo] ( @sCo_AdiGrupo CHAR(8) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAdiGrupo
        WHERE
            co_adigrupo = @sCo_AdiGrupo
    END
```
