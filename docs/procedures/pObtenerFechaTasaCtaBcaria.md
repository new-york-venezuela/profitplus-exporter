# SP: pObtenerFechaTasaCtaBcaria
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerFechaTasaCtaBcaria
*AUTOR			:		SOFTECH SISTEMAS.
*CREACIÓN		:		<2012-03-09>
*MODIFICACIÓN	:		<2012-03-09>
*DESCRIPCIÓN	:		Obtiene la ultima fecha de una tasa igtf  insertada para un cuenta
************************************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerFechaTasaCtaBcaria]
    (
      @sCod_Cta CHAR(6) ,
      @dtFecha SMALLDATETIME
    )
AS 
    BEGIN

        DECLARE @dtFechaResult SMALLDATETIME
        DECLARE @deValor_porcent DECIMAL(18, 2) 
        --DECLARE @deTasa_V DECIMAL(21, 8) 
        --DECLARE @boRelacionInversa BIT

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
            @dtFechaResult = TZ.fecha_regis, @deValor_porcent = valor_porcent
        FROM
            saImpuestoCuentaBancaria TZ
        WHERE
            TZ.cod_cta = @sCod_Cta
            AND ( TZ.fecha_regis <= @dtFecha
                  OR @dtFecha IS NULL
                )
        ORDER BY
            TZ.fecha_regis DESC

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SELECT TOP ( 1 )
                    @dtFechaResult = TZ.fecha_regis, @deValor_porcent = valor_porcent
                FROM
                    saImpuestoCuentaBancaria TZ
                WHERE
                    TZ.cod_cta = @sCod_Cta
                    AND ( TZ.fecha_regis > @dtFecha
                          OR @dtFecha IS NULL
                        )
                ORDER BY
                    TZ.fecha_regis ASC
            END

        IF ( @dtFechaResult IS NULL ) 
            BEGIN
                SET @dtFechaResult = CONVERT(DATETIME, '19000101', 112)
                SET @deValor_porcent = 1
            END


        SELECT 
            @dtFechaResult AS FECHA, @deValor_porcent AS Valor_porcent

    END
```
