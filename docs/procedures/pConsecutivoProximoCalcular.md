# SP: pConsecutivoProximoCalcular
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pConsecutivoProximoCalcular
*DESCRIPCIÓN	: Calcula mediante manejo de string el proximo numero
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-07-14
**************************************************************************/

CREATE PROCEDURE [pConsecutivoProximoCalcular]
    (
      @sCo_Sucur CHAR(6) = NULL ,
      @sCo_Consecutivo CHAR(16) ,
      @intTipoConsecutivo INT ,
      @intLongitud INT ,
      @intDesdeN BIGINT ,
      @intHastaN BIGINT ,
      @intProximoN BIGINT ,
      @strDesdeA CHAR(16) ,
      @strHastaA CHAR(16) ,
      @strProximoA CHAR(16) ,
      @bReiniciar BIT ,
      @strTabla CHAR(32) ,
      @coSerie CHAR(20) ,
      @strPrefijo CHAR(10) ,
      @strSufijo CHAR(10)
    )
AS 
    BEGIN	

        DECLARE @MensajeError VARCHAR(128)

        DECLARE @isDoc_Com BIT
        DECLARE @isDoc_Ven BIT
        DECLARE @strCo_Tipo_Doc CHAR(6)

        SET @strCo_Tipo_Doc = NULL

        IF ( @sCo_Consecutivo LIKE 'DOC_COM_%' ) 
            SET @isDoc_Com = 1
        ELSE 
            SET @isDoc_Com = 0
		
        IF ( @sCo_Consecutivo LIKE 'DOC_VEN_%' ) 
            SET @isDoc_Ven = 1
        ELSE 
            SET @isDoc_Ven = 0

        IF ( @isDoc_Com = 1
             OR @isDoc_Ven = 1
           ) 
            BEGIN
                SET @strCo_Tipo_Doc = SUBSTRING(@sCo_Consecutivo, 9, 6)
                IF CHARINDEX('_', @strCo_Tipo_Doc) > 0 
                    SET @strCo_Tipo_Doc = SUBSTRING(@strCo_Tipo_Doc, 1,
                                                    CHARINDEX('_',
                                                              @strCo_Tipo_Doc)
                                                    - 1)

                IF ( NOT EXISTS ( SELECT    *
                                  FROM      saTipoDocumento
                                  WHERE     co_tipo_doc = @strCo_Tipo_Doc )
                   ) 
                    BEGIN
                        SET @MensajeError = 'No existe el tipo de documento "'
                            + RTRIM(@strCo_Tipo_Doc)
                            + '" asociado al consecutivo "'
                            + RTRIM(@sCo_Consecutivo) + '"'
                        RAISERROR(@MensajeError,16,1)
                        RETURN
                    END
            END

        IF ( @intTipoConsecutivo IS NULL ) 
            BEGIN
```
