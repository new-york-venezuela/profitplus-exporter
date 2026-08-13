# SP: pValidarRangoSerie
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pValidarRangoSerie]
*DESCRIPCIÓN	: Validar el rango de la serie válida 
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-12-28
**************************************************************************/

CREATE PROCEDURE [dbo].[pValidarRangoSerie]
    (
      @sNumero CHAR(20) ,
      @sCo_Consecutivo CHAR(16) ,
      @sCo_Sucur CHAR(6)
    )
AS 
    BEGIN	
        DECLARE @bRetorno INT
	
        DECLARE
            @intTipoConsecutivo INT ,
            @coSerie CHAR(20)
        DECLARE
            @intDesdeN BIGINT ,
            @intHastaN BIGINT
        DECLARE
            @strDesdeA CHAR(16) ,
            @strHastaA CHAR(16)
        DECLARE
            @strPrefijo CHAR(10) ,
            @strSufijo CHAR(10)
        DECLARE
            @sRangoDesde CHAR(20) ,
            @sRangoHasta CHAR(20)
				
				
				
        SET @bRetorno = 0
				
        SELECT
            @coSerie = saConsecutivo.co_serie, @intTipoConsecutivo = saSerieTipo.tipo, @strPrefijo = saSerieTipo.prefijo,
            @strSufijo = saSerieTipo.sufijo, @intDesdeN = saSerie.desde_n, @intHastaN = saSerie.hasta_n,
            @strDesdeA = saSerie.desde_a, @strHastaA = saSerie.hasta_a
        FROM
            saConsecutivo
            INNER JOIN saSerie ON saConsecutivo.co_serie = saSerie.co_serie
            INNER JOIN saSerieTipo ON saSerieTipo.co_tipo_serie = saSerie.co_tipo_serie
            INNER JOIN saConsecutivoTipo ON saConsecutivoTipo.co_consecutivo = saConsecutivo.co_consecutivo
        WHERE
            saConsecutivo.co_sucur = @sCo_Sucur
            AND saConsecutivo.co_consecutivo = @sCo_Consecutivo
					

        SET @sRangoDesde = RTRIM(@strPrefijo) + RTRIM(CASE WHEN @intTipoConsecutivo = 1 THEN @strDesdeA
                                                           ELSE CAST(@intDesdeN AS VARCHAR(16))
                                                      END) + RTRIM(@strSufijo)
        SET @sRangoHasta = RTRIM(@strPrefijo) + RTRIM(CASE WHEN @intTipoConsecutivo = 1 THEN @strHastaA
                                                           ELSE CAST(@intHastaN AS VARCHAR(16))
                                                      END) + RTRIM(@strSufijo)

        IF @sNumero BETWEEN @sRangoDesde AND @sRangoHasta 
            BEGIN 
                SET @bRetorno = 1 -- se asigna 1 si el numero esta dentro del rango 
                SELECT
```
