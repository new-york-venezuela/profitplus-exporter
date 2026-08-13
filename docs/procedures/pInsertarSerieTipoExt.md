# SP: pInsertarSerieTipoExt
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	pInsertarSerieTipoExt
-- DESCRIPCION	:	Inserta un registro en la tabla saSerieTipoExt
-- UPDATE DATE  :   <2019-04-05>
-- CREADO POR	:	SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarSerieTipoExt]
    (
	  @gRowguid_Serietipo UNIQUEIDENTIFIER,
	  @sCo_Serie CHAR(1) = NULL,
	  @sCo_Negocio CHAR(2) = NULL,
	  @sPunto_Emi CHAR(3) = NULL,
	  @sArea_Imp CHAR(3) = NULL,
	  @sCo_Tipo CHAR(3) = NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) = NULL ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
	  @sdFe_venc SMALLDATETIME, 
	  @iNotiDiaVenc INT,
	  @iNotiFinSerie INT
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

        INSERT  INTO saSerieTipoExt
                ( rowguid_serietipo, co_serie, co_negocio, punto_emi, area_imp, co_tipo, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
				  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, transfe, fe_venc, notidiavenc, notifinserie)
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @gRowguid_Serietipo, @sCo_Serie, @sCo_Negocio, @sPunto_Emi, @sArea_Imp, @sCo_Tipo,
				  @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7,
                  @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, 
				  GETDATE(), @sRevisado, @sTrasnfe, @sdFe_venc, @iNotiDiaVenc, @iNotiFinSerie)
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saSerieTipoExt', @
```
