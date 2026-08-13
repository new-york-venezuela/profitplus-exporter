# SP: pObtenerFechaTasa
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerFechaTasa
*AUTOR			:		SOFTECH SISTEMAS.
*CREACIÓN		:		<2011-12-12>
*MODIFICACIÓN	:		<2020-08-03>
*DESCRIPCIÓN	:		Obtiene la ultima fecha de una tasa insertada para un moneda
************************************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerFechaTasa]
    (
      @sCo_Mone CHAR(6) ,
      @dtFecha SMALLDATETIME
    )
AS 
    BEGIN

        DECLARE @dtFechaResult SMALLDATETIME
        DECLARE @deTasa_C DECIMAL(21, 8) 
        DECLARE @deTasa_V DECIMAL(21, 8) 
        DECLARE @boRelacionInversa BIT

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
            @dtFechaResult = TZ.fecha, @deTasa_C = TZ.tasa_c, @deTasa_V = TZ.tasa_v, @boRelacionInversa = MO.relacion
        FROM
            saTasa TZ
            INNER JOIN saMoneda MO ON MO.co_mone = TZ.co_mone
        WHERE
            TZ.co_mone = @sCo_Mone
            AND ( TZ.fecha <= @dtFecha
                  OR @dtFecha IS NULL
                )
        ORDER BY
            TZ.fecha DESC

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SELECT TOP ( 1 )
                    @dtFechaResult = TZ.fecha, @deTasa_C = TZ.tasa_c, @deTasa_V = TZ.tasa_v,
                    @boRelacionInversa = MO.relacion
                FROM
                    saTasa TZ
                    INNER JOIN saMoneda MO ON MO.co_mone = TZ.co_mone
                WHERE
                    TZ.co_mone = @sCo_Mone
                    AND ( TZ.fecha > @dtFecha
                          OR @dtFecha IS NULL
                        )
                ORDER BY
                    TZ.fecha ASC
            END

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SET @dtFechaResult = CONVERT(DATETIME, '19000101', 112)
                SET @deTasa_C = 1
                SET @deTasa_V = 1
            END

        IF ( @boRelacionInversa = 1 ) 
            BEGIN
                SET @deTasa_C = ROUND(1 / @deTasa_C, 8)
                SET @deTasa_V = ROUND(1
```
