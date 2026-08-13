# SP: pInsertarInventarioFisico
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarInventarioFisico
*DESCRIPCIÓN	: Inserta un InventarioFisico
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarInventarioFisico]
    (
      @sCo_InvFisico CHAR(20) ,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
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

        INSERT  INTO saInventarioFisico
                ( co_invfisico, des_invfisico, co_alma, inicio, cierre, art_cero, ajue_num, procesado, co_tipo_ent,
                  co_tipo_sal, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
                  fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_InvFisico, @sDes_InvFisico, @sCo_Alma, @sdInicio, @sdCierre, @bArt_Cero, @sAjue_Num, @bProcesado,
                  @sCo_Tipo_Ent, @sCo_Tipo_Sal, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7,
                  @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado,
                  @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id =
```
