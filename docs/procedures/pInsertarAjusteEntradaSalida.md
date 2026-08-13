# SP: pInsertarAjusteEntradaSalida
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)

## Código (excerpt)
```sql
/********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE : pInsertarAjusteEntradaSalida
*DESCRIPCION : Insertra un ajuste
*AUTOR: SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [pInsertarAjusteEntradaSalida]
    (
      @sAjue_Num CHAR(20) ,
      @sCo_Mone CHAR(6) ,
      @sMotivo VARCHAR(80) ,
      @sdFecha SMALLDATETIME ,
      @deTasa DECIMAL(21, 8) ,
      @bAnulado BIT ,
      @sCo_InvFisico VARCHAR(20) = NULL ,
      @deAux01 DECIMAL(18, 5) ,
      @sAux02 VARCHAR(30) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL 	
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
			
        INSERT  INTO saAjuste
                ( ajue_num, fecha, motivo, tasa, co_mone, dis_cen, campo1, campo2, campo3, campo4, campo5, campo6,
                  campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe,
                  anulado, aux01, aux02, co_invfisico )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sAjue_Num, @sdFecha, @sMotivo, @deTasa, @sCo_Mone, @sDis_Cen, @sCampo1, @sCampo2, @sCampo3, @sCampo4,
                  @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sRevisado, @sTrasnfe, @bAnulado, @deAux01, @sAux02, @sCo_InvFisico )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

			-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sC
```
