# SP: pInsertarResInventario
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saResInventario`](../tables/saResInventario.md)

## Código (excerpt)
```sql
/********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE : pInsertarResInventario
*DESCRIPCIÓN : Insertra un Resultado de Inventario
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [pInsertarResInventario]
    (
      @sNum_ResInv CHAR(20) ,
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
			
        INSERT  INTO saResInventario
                ( num_resinv, des_resinv, fecha, co_invfisico, co_alma, co_mone, tasa, campo1, campo2, campo3, campo4,
                  campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  revisado, trasnfe )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sNum_ResInv, @sDes_ResInv, @sdFecha, @sCo_InvFisico, @sCo_Alma, @sCo_Mone, @deTasa, @sCampo1,
                  @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

			-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saResInventario', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
```
