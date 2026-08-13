# SP: pConsecutivoProximoCalcularNCF
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pConsecutivoProximoCalcularNCF
*DESCRIPCIÓN	: Calcula mediante manejo de string el proximo numero
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-07-14
*LAST UPDATE    : 2019-04-25
**************************************************************************/
CREATE PROCEDURE [dbo].[pConsecutivoProximoCalcularNCF]
(
	@sCo_Sucur CHAR(6) = NULL ,
	@sCo_Consecutivo CHAR(16) ,
	@intTipoConsecutivo INT ,
	@intLongitud INT ,
	@intDesdeN BIGINT ,
	@intHastaN BIGINT ,
	@intProximoN BIGINT ,
	@bReiniciar BIT ,
	@strTabla CHAR(32) ,
	@coSerie CHAR(20) ,
	@strPrefijo CHAR(10) ,
	@strSufijo CHAR(10),
	--Nuevos parametros
	@sPunto_Emi CHAR(3) = NULL,
	@sArea_Imp CHAR(3) = NULL,
	@sCo_Tipo CHAR(3) = NULL
)
AS 
    BEGIN	

        DECLARE @MensajeError VARCHAR(128)

        DECLARE @isDoc_Com_NCF BIT
        DECLARE @isDoc_Ven_NCF BIT
        DECLARE @strCo_Tipo_Doc CHAR(6)

        SET @strCo_Tipo_Doc = NULL

        IF ( @intTipoConsecutivo IS NULL ) 
            BEGIN
                SET @MensajeError = 'No existe información para el consecutivo "'
                    + RTRIM(@sCo_Consecutivo) + '"'
                IF ( @sCo_Sucur IS NULL
                     OR @sCo_Sucur = ''
                   ) 
                    SET @MensajeError = @MensajeError + '.'
                ELSE 
                    SET @MensajeError = @MensajeError + ' en la sucursal "'
                        + RTRIM(@sCo_Sucur) + '".'

                RAISERROR(@MensajeError,16,1)
                RETURN
            END

        DECLARE @bolExisteNCF BIT
        DECLARE @strConsecutivoResult CHAR(20)
		DECLARE @strConsecutivoResultOut CHAR(20)
        DECLARE @intConsecutivoResultInicialInt BIGINT

        SET @intConsecutivoResultInicialInt = NULL

        SET @bolExisteNCF = 1

		-- Tipo numerico
        IF @intTipoConsecutivo = 0 
            BEGIN
                WHILE ( @bolExisteNCF = 1 ) 
                    BEGIN
				-- Calculo proximo numero

                        IF ( @intProximoN IS NULL ) 
                            SET @intProximoN = @intDesdeN -- Cuando se crea se puede asignar nulo que traduce en adjudicar el primero
                        ELSE 
                            BEGIN
                                SET @intProximoN = @intProximoN + 1
				
                                IF ( @intProximoN > @intHastaN )
```
