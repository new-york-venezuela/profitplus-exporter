# SP: pActualizarInventarioFisico
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarInventarioFisico]
*DESCRIPCIÓN	: Actualizar un Inventario Fisico
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarInventarioFisico]
    (
      @sCo_InvFisico CHAR(20) ,
      @sCo_InvFisicoOri CHAR(20) ,
      @sDes_InvFisico VARCHAR(60) ,
      @sCo_Alma CHAR(6) = NULL ,
      @sdInicio SMALLDATETIME ,
      @sdCierre SMALLDATETIME ,
      @bArt_Cero BIT ,
      @sAjue_Num CHAR(20) = NULL ,
      @sCo_Tipo_Ent CHAR(6) = NULL ,
      @sCo_Tipo_Sal CHAR(6) = NULL ,
      @bProcesado BIT ,
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
      @gRowguid UNIQUEIDENTIFIER = NULL 		
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

        UPDATE
            saInventarioFisico
        SET co_invfisico = @sCo_InvFisico, des_invfisico = @sDes_InvFisico, co_alma = @sCo_Alma, inicio = @sdInicio,
            cierre = @sdCierre, art_cero = @bArt_Cero, ajue_num = @sAjue_Num, co_tipo_ent = @sCo_Tipo_Ent,
            co_tipo_sal = @sCo_Tipo_Sal, procesado = @bProcesado, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_invfisico = @sCo_InvFisicoOri
            AND validador = @tsValidador
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        S
```
