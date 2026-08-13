# SP: pConsecutivoProximo
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pConsecutivoProximo
*DESCRIPCIÓN	: Obtiene el próximo consecutivo de la serie en una sucursal
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-07-14
**************************************************************************/

CREATE PROCEDURE [pConsecutivoProximo]
    (
      @sCo_Sucur CHAR(6) = NULL ,
      @sCo_Consecutivo CHAR(16)
    )
AS 
    BEGIN	

        DECLARE
            @intTipoConsecutivo INT ,
            @intLongitud INT
        DECLARE
            @intDesdeN BIGINT ,
            @intHastaN BIGINT ,
            @intProximoN BIGINT
        DECLARE
            @strDesdeA CHAR(16) ,
            @strHastaA CHAR(16) ,
            @strProximoA CHAR(16)
        DECLARE
            @bReiniciar BIT ,
            @strTabla CHAR(32)
        DECLARE
            @coSerie CHAR(20) ,
            @strPrefijo CHAR(10) ,
            @strSufijo CHAR(10)
        DECLARE @MensajeError VARCHAR(128)
        DECLARE @strConsecutivoResult CHAR(20)
        DECLARE @strNext CHAR(20)
        DECLARE @intNext BIGINT

        SELECT
            @intTipoConsecutivo = saSerieTipo.tipo, @intDesdeN = saSerie.desde_n, @intHastaN = saSerie.hasta_n,
            @intProximoN = saSerie.prox_n, @intLongitud = saSerieTipo.longitud, @bReiniciar = saSerieTipo.reiniciar,
            @coSerie = saConsecutivo.co_serie, @strTabla = saConsecutivoTipo.Tabla, @strPrefijo = saSerieTipo.prefijo,
            @strSufijo = saSerieTipo.sufijo, @strDesdeA = saSerie.desde_a, @strHastaA = saSerie.hasta_a,
            @strProximoA = saSerie.prox_a
        FROM
            saConsecutivo
            INNER JOIN saSerie ON saConsecutivo.co_serie = saSerie.co_serie
            INNER JOIN saSerieTipo ON saSerieTipo.co_tipo_serie = saSerie.co_tipo_serie
            INNER JOIN saConsecutivoTipo ON saConsecutivoTipo.co_consecutivo = saConsecutivo.co_consecutivo
        WHERE
            ( saConsecutivo.co_sucur = @sCo_Sucur
              OR ( saConsecutivo.co_sucur IS NULL
                   AND @sCo_Sucur = ''
                 )
            )
            AND saConsecutivo.co_consecutivo = @sCo_Consecutivo

        DECLARE @TablaResult TABLE
            (
              ProximoConsecutivo CHAR(20) ,
              ProxString CHAR(20) ,
              ProxInt BIGINT
            )


        INSERT  INTO @TablaResult
                ( ProximoConsecutivo, ProxString,
```
