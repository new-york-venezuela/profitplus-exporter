# SP: pInsertarArtCaracteristicaRenglon
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarUnidadArticuloRenglon
*DESCRIPCIÓN	: Inserta Unidad por Articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pInsertarArtCaracteristicaRenglon]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Lin CHAR(6) ,
      @iReng_Num INT ,
 
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saArtCaracteristica
                ( co_art, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  revisado )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art,@sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sRevisado)
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @sCamp VARCHAR(MAX)

        SET @sCamp = @sCo_Art + ',' + @sCo_Lin

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtCaracteristica', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCamp
		
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
