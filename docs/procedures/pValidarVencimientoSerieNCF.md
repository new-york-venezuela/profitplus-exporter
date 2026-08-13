# SP: pValidarVencimientoSerieNCF
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
/***********************************************************************
NOMBRE: [pValidarVencimientoSerieNCF]
DESCRIPCION: Se encarga de validar el vencimiento de la serie NCF de acuerdo al parametro iTipoVenc:
1 = dias fecha vencimiento
2 = cantidad de correlativos para finalizar la serie 
CREADO POR: SOFTECH SISTEMAS
CREATE DATE : 2019-04-12
LAST UPDATE : 2019-04-12
************************************************************************/ 
CREATE PROCEDURE [dbo].[pValidarVencimientoSerieNCF] 
(
      @sCo_Sucur CHAR(6) = NULL ,
	  @iTipoVenc  INT,
      @sCo_Consecutivo CHAR(16),
	  @sdFecEmis SMALLDATETIME
 )
AS 
    BEGIN
        
		DECLARE @sdFe_venc SMALLDATETIME
		DECLARE @iNotiDiaVenc  INT
		DECLARE @iNotiFinSerie INT
		DECLARE @intTipoConsecutivo INT
		DECLARE @iDiferenciaDias INT 
		DECLARE @coSerie CHAR(20)
		DECLARE @intHastaN BIGINT  
		DECLARE @intProximoN BIGINT


		SELECT @intTipoConsecutivo = saSerieTipo.tipo, @coSerie = saConsecutivo.co_serie,
		    @sdFe_venc = saSerieTipoExt.fe_venc, @iNotiDiaVenc = saSerieTipoExt.notidiavenc,
			@iNotiFinSerie = saSerieTipoExt.notifinserie, @intHastaN = saSerie.hasta_n,
			@intProximoN = saSerie.prox_n
        FROM
            saConsecutivo
            INNER JOIN saSerie ON saConsecutivo.co_serie = saSerie.co_serie
            INNER JOIN saSerieTipo ON saSerieTipo.co_tipo_serie = saSerie.co_tipo_serie
			INNER JOIN saSerieTipoExt ON saSerieTipoExt.rowguid_serietipo = saSerieTipo.rowguid
            INNER JOIN saConsecutivoTipo ON saConsecutivoTipo.co_consecutivo = saConsecutivo.co_consecutivo
        WHERE
            ( saConsecutivo.co_sucur = @sCo_Sucur
              OR ( saConsecutivo.co_sucur IS NULL
                   AND @sCo_Sucur = ''
                 )
            )
            AND saConsecutivo.co_consecutivo LIKE @sCo_Consecutivo + '%'
		

		--Para saltar la alerta por fecha de vencimiento de la serie
		IF (NOT @sdFe_venc IS NULL) AND (convert(date,@sdFecEmis,103) > convert(date,@sdFe_venc,103))		
            BEGIN
			   SELECT ''
			   RETURN
			END


        IF (@iTipoVenc = 1)
		   BEGIN
		      IF (convert(date,@sdFecEmis,103) <= convert(date,@sdFe_venc,103))
			    BEGIN
					SET @iDiferenciaDias = DATEDIFF(DAY, @sdFecEmis, @sdFe_venc)

					IF (@iDiferenciaDias <= @iNotiDiaVenc) 
					   BEGIN
						 IF @iDiferenciaDias > 0
							SELECT 'La serie "' + RTRIM(@coSerie) + '" culmina en ' + CONVERT(NVARCHAR(20),@iDiferencia
```
