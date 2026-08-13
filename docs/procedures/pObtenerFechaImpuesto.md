# SP: pObtenerFechaImpuesto
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerFechaImpuesto
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		Obtiene la ultima fecha de una tasa insertada para un moneda
************************************************************************************************/

CREATE PROCEDURE [pObtenerFechaImpuesto]
    (
      @sCo_Imp CHAR(6) ,
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
                SELECT TOP ( 1 )
                    @dtFechaResult = fecha_regis, @deValor = valor_porcent
                FROM
                    saImpuestoReng
                WHERE
                    cod_impuesto = @sCo_Imp
                    AND ( fecha_regis > @dtFecha
                          OR @dtFecha IS NULL
                        )
                ORDER BY
                    fecha_regis ASC
            END

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SET @dtFechaResult = CONVERT(DATETIME, '19000101', 112)
                SET @deValor = 0
            END

        SELECT
            @dtFechaResult AS FECHA, @deValor AS VALOR

    END
```
