# SP: pInsertarSerieTipo
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author: SOFTECH SISTEMAS
-- Create date: 2017-06-23
-- Last update date: 2019-04-05
-- Description:	Inserta un registro en la tabla saSerieTipo
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarSerieTipo]
 (
      @sCo_Tipo_Serie CHAR(6) ,
      @sDes_Tipo_Serie VARCHAR(60) ,
      @sPrefijo CHAR(10) ,
      @sSufijo CHAR(10) ,
      @iLongitud INT ,
      @sDesde_A CHAR(16) ,
      @iDesde_N bigint ,
      @sHasta_A CHAR(16) ,
      @iHasta_N bigInt ,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
	  @bAplica_ncf BIT,
	  @sCo_Serie CHAR(1) = NULL,
	  @sCo_Negocio CHAR(2) = NULL,
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
              fe_us_in DATETIME,
              fe_us_mo DATETIME,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saSerieTipo
                ( co_tipo_serie, des_tipo_serie, prefijo, sufijo, longitud, desde_a, desde_n, hasta_a, hasta_n, tipo,
                  reiniciar, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
                  fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, aplica_ncf)
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Tipo_Serie, @sDes_Tipo_Serie, @sPrefijo, @sSufijo, @iLongitud, @sDesde_A, @iDesde_N, @sHasta_A,
                  @iHasta_N, @iTipo, @bReiniciar, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7,
                  @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado,
                  @sTrasnfe , @bAplica_ncf )
	
        DECLARE @dtFe_In DAT
```
