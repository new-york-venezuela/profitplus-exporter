# SP: pActualizarAjusteEntradaSalida
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE: pActualizarAjuste
*DESCRIPCIÓN : Actualiza un ajuste
*AUTOR: SOFTECH SISTEMAS
*MODIFICADO POR: SOFTECH SISTEMAS
*MODIFICADO EL: 27/07/2020
***********************************************************************/

CREATE PROCEDURE [pActualizarAjusteEntradaSalida]
    (
      @sAjue_Num CHAR(20) ,
      @sAjue_NumOri CHAR(20) ,
      @sdFecha SMALLDATETIME ,
      @sMotivo VARCHAR(80) ,
	--@iseriales_e	INT,
	--@iseriales_s	INT,
      @deTasa DECIMAL(21, 8) ,
      @sCo_Mone CHAR(6) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @bAnulado BIT ,
      @sCo_InvFisico CHAR(20) = NULL ,
      @deAux01 DECIMAL(18, 5) ,
      @sAux02 VARCHAR(30) ,
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
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN		
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER ,
              anuladaOld BIT ,
              anuladaNew BIT
            )
				
        UPDATE
            saAjuste
        SET ajue_num = @sAjue_Num, fecha = @sdFecha, motivo = @sMotivo,	
			--seriales_e	= @iseriales_e,
			--seriales_s	= @iseriales_s,
            tasa = @deTasa, co_mone = @sCo_Mone, dis_cen = @sDis_Cen, anulado = @bAnulado, co_invfisico = @sCo_InvFisico,
            aux01 = @deAux01, aux02 = @sAux02, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3,
            campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid, DELETED.anulado,
            INSERTED.anulado
            INTO @TableTimestamp
```
