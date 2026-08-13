# SP: pActualizarSerieTipo
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	pActualizarSerieTipo
-- DESCRIPCION	:	Actualiza un registro en la tabla saSerieTipo
-- CREADO POR	:	SOFTECH SISTEMAS
-- CREATE DATE  : <2019-04-05>
-- LAST UPDATE  : <2019-04-05>
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarSerieTipo]
    (
      @sCo_Tipo_Serie CHAR(6) ,
      @sCo_Tipo_SerieOri CHAR(6) ,
      @sDes_Tipo_Serie VARCHAR(60) ,
      @sPrefijo CHAR(10) ,
      @sSufijo CHAR(10) ,
      @iLongitud INT ,
      @sDesde_A CHAR(20) ,
      @iDesde_N BIGINT ,
      @sHasta_A CHAR(20) ,
      @iHasta_N BIGINT ,
      @iTipo INT ,
      @bReiniciar BIT ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL, 
	  @bAplica_ncf BIT,
	  @sPunto_Emi CHAR(3) = NULL,
	  @sArea_Imp CHAR(3) = NULL,
	  @sCo_Tipo CHAR(3) = NULL,
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
			  co_us_in CHAR(6),
			  co_sucu_in CHAR(6),
              rowguid UNIQUEIDENTIFIER
            )


        UPDATE
            saSerieTipo
        SET co_tipo_serie = @sCo_Tipo_Serie, des_tipo_serie = @sDes_Tipo_Serie, prefijo = @sPrefijo, sufijo = @sSufijo,
            longitud = @iLongitud, desde_a = @sDesde_A, desde_n = @iDesde_N, hasta_a = @sHasta_A, hasta_n = @iHasta_N,
            tipo = @iTipo, reiniciar = @bReiniciar, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3,
            campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.co_us_in, Inse
```
