# SP: pObtenerSerieProceso
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pObtenerSerieProceso
*DESCRIPCIÓN	: Optiene el codigo del consecutivo y de la serie asociada al proceso
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE  PROCEDURE [pObtenerSerieProceso]
    (
      @codigoConsecutivo VARCHAR(16) ,
      @sCo_sucur VARCHAR(6) ,
      @sCo_emp VARCHAR(20)
    )
AS 
    BEGIN

        SELECT
            saconsecutivo.co_consecutivo, saConsecutivoTipo.des_consecutivo AS Consecutivo,
            saconsecutivo.co_serie AS Serie
        FROM
            saConsecutivoTipo
            INNER JOIN saconsecutivo ON ( ( saConsecutivoTipo.Usoempresa = 1
                                            AND saconsecutivo.co_emp = @sCo_emp
                                          )
                                          OR ( saConsecutivoTipo.UsoSucursal = 1
                                               AND saconsecutivo.co_sucur = @sCo_sucur
                                             )
                                        )
                                        AND saConsecutivoTipo.co_consecutivo = saconsecutivo.co_consecutivo
        WHERE
            saConsecutivoTipo.co_consecutivo LIKE @codigoConsecutivo + '%'
            AND saconsecutivo.co_consecutivo LIKE @codigoConsecutivo + '%'
            AND saconsecutivo.co_serie IS NOT NULL
        ORDER BY
            saconsecutivo.co_consecutivo ASC
 

    END
```
