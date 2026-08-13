# SP: pSeleccionarAdiCampo
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pSeleccionarAdiGrupo
*DESCRIPCIÓN	: Seleccciona un campo adicional
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-08-24
**************************************************************************/
CREATE PROCEDURE [pSeleccionarAdiCampo] ( @sCo_AdiCampo CHAR(8) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saAdiCampo
        WHERE
            co_adicampo = @sCo_AdiCampo
    END
```
