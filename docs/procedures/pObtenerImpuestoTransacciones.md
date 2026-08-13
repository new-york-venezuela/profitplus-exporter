# SP: pObtenerImpuestoTransacciones
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			: [pObtenerImpuestoTransacciones]
*DESCRIPCIÓN	: 
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2011-11-01
*************************************************************************************************/

CREATE PROCEDURE [pObtenerImpuestoTransacciones](

      @sCo_Imp CHAR(6) = 'ITF' ,
      @dtFecha SMALLDATETIME
    )
AS 
    BEGIN

        DECLARE @dtFechaResult SMALLDATETIME
        DECLARE @deValor DECIMAL(18, 2)

        IF ( DATEPART(hh, @dtFecha) = 0
             AND DATEPART(mi, @dtFecha) = 0
             AND DATEPART(ss, @dtFecha) = 0
             AND DATEPART(ms, @dtFecha) = 0
           ) 
            BEGIN
                SET @dtFecha = DATEADD(hh, 23, @dtFecha)
                SET @dtFecha = DATEADD(mi, 59, @dtFecha)
            END

        SELECT TOP ( 1 )
            @dtFechaResult = fecha_regis, @deValor = valor_porcent
        FROM
            saImpuestoReng
        WHERE
            cod_impuesto = @sCo_Imp
            AND ( fecha_regis <= @dtFecha
                  OR @dtFecha IS NULL
                )
        ORDER BY
            fecha_regis DESC

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SET @deValor = 0
            END

        SELECT
            @deValor AS VALOR

    END
```
