# SP: pActualizarResInventario
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saResInventario`](../tables/saResInventario.md)

## Código (excerpt)
```sql
/**********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE: [pActualizarResInventario]
*DESCRIPCIÓN : Actualización de los Resultados de Inventario
*AUTOR: SOFTECH SISTEMAS
***********************************************************************/

CREATE PROCEDURE [pActualizarResInventario]
    (
      @sNum_ResInv CHAR(20) ,
      @sNum_ResInvOri CHAR(20) ,
      @sDes_ResInv VARCHAR(60) = NULL ,
      @sdFecha SMALLDATETIME ,
      @sCo_InvFisico CHAR(20) ,
      @sCo_Alma CHAR(6) ,
      @sCo_Mone CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
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
              rowguid UNIQUEIDENTIFIER
            ) ;
		
        UPDATE
            saResInventario
        SET num_resinv = @sNum_ResInv, des_resinv = @sDes_ResInv, fecha = @sdFecha, co_invfisico = @sCo_InvFisico,
            co_alma = @sCo_Alma, co_mone = @sCo_Mone, tasa = @deTasa, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            num_resinv = @sNum_ResInvOri
            AND validador = @tsValidador
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
        IF @dtFe_In IS NOT NULL 
            BEGIN
```
