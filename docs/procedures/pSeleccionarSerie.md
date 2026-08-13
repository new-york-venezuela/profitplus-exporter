# SP: pSeleccionarSerie
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarChequera
*DESCRIPCIÓN	: Actualizar chequera
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pSeleccionarSerie]
    (
      @bUsoEmpresa BIT ,
      @sCo_emp VARCHAR(20) ,
      @sCo_sucur VARCHAR(6)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saconsecutivo
        WHERE
            co_consecutivo LIKE 'DOC_VEN_FACT%'
            AND co_serie IS NOT NULL
            AND ( ( @bUsoEmpresa = 1
                    AND co_emp = @sCo_emp
                  )
                  OR ( @bUsoEmpresa = 0
                       AND co_sucur = @sCo_sucur
                     )
                )
    END
```
