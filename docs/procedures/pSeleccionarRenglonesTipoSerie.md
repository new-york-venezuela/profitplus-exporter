# SP: pSeleccionarRenglonesTipoSerie
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pSeleccionarRenglonesTipoSerie
DESCRIPCION: 
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesTipoSerie]
    (
      @sCo_Tipo_Serie CHAR(6)
    )
AS 
    BEGIN

        SELECT
            *
        FROM
            saSerie
        WHERE
            co_tipo_serie = @sCo_Tipo_Serie
        ORDER BY
            reng_num ASC

    END
```
