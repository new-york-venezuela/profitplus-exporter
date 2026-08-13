# SP: pConsecutivoProximoNCF
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
-- =========================================================================
-- Author: 		SOFTECH SISTEMAS
-- Create date: 2009-07-14
-- Last Update:	2019-04-11
-- Description:	Obtiene el próximo consecutivo de la serie en una sucursal
-- =========================================================================
CREATE PROCEDURE [dbo].[pConsecutivoProximoNCF]
    (
      @sCo_Sucur CHAR(6) = NULL ,
      @sCo_Consecutivo CHAR(16),
	  @sPunto_Emi CHAR(3) = NULL,
	  @sArea_Imp CHAR(3) = NULL,
	  @sdFecEmis SMALLDATETIME = NULL
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
            @sCo_tipo CHAR(16)
        DECLARE
            @bReiniciar BIT ,
            @strTabla CHAR(32)
        DECLARE
            @coSerie CHAR(20) ,
            @strPrefijo CHAR(10) ,
            @strSufijo CHAR(10)

        DECLARE @MensajeError VARCHAR(150)
        DECLARE @strConsecutivoResult CHAR(20)
        DECLARE @strNext CHAR(20)
        DECLARE @intNext BIGINT
        DECLARE @pk_CodSerie CHAR(6)
		DECLARE @iDiferenciaDias INT
		DECLARE @iNotiDiaVenc  INT
		DECLARE @iNotiFinSerie INT

		DECLARE @sdFe_venc SMALLDATETIME
	
		--IF ( @sPunto_Emi = '' OR @sArea_Imp = '' )
		--BEGIN
		--	SET @MensajeError = 'Es necesario configurar un punto de emisión y área de impresión para generar un Número de Comprobante Fiscal asociado al documento.'
		--	RAISERROR(@MensajeError,16,1)
		--	RETURN;
		--END

        SELECT
		@intTipoConsecutivo=  saSerieTipo.tipo, @intDesdeN = saSerie.desde_n, @intHastaN = saSerie.hasta_n,
		@intProximoN = saSerie.prox_n,  @intLongitud = saSerieTipo.longitud, @bReiniciar = saSerieTipo.reiniciar,
		@coSerie = saConsecutivo.co_serie, @strPrefijo = saSerieTipo.prefijo, @strSufijo = saSerieTipo.sufijo, 
		@sPunto_Emi = saSerieTipoExt.punto_emi, @sArea_Imp = saSerieTipoExt.area_imp,  @sCo_tipo = saSerieTipoExt.co_tipo,
		@strTabla = saConsecutivoTipo.Tabla, @pk_CodSerie = saSerieTipo.co_tipo_serie, @sdFe_venc = saSerieTipoExt.fe_venc,
		@iNotiDiaVenc = saSerieTipoExt.notidiavenc, @iNotiFinSerie = saSerieTipoExt.notifinserie

        FROM
            saConsecutivo
            INNER JOIN saSerie ON saConsecutivo.co_serie = saSerie.co_serie
            INNER JOIN saSerieTipo ON saSerieTipo.co_tipo_serie = saSerie.co_tipo_s
```
