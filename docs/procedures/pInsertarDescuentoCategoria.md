# SP: pInsertarDescuentoCategoria
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saDescCategoria`](../tables/saDescCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarDescuento
DESCRIPCION: Inserta un registro en las tablas descuentos de acuerdo al contexto
CREADO POR: SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarDescuentoCategoria]
    (
      @sCo_Desc CHAR(6) ,
      @sDes_Des VARCHAR(60) = NULL ,
      @sCo_Lin CHAR(6) = NULL ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Cat CHAR(6) = NULL ,
      @sTip_Cli CHAR(6) = NULL ,
      @deHasta1 DECIMAL(18, 2) ,
      @deHasta2 DECIMAL(18, 2) ,
      @deHasta3 DECIMAL(18, 2) ,
      @deHasta4 DECIMAL(18, 2) ,
      @deHasta5 DECIMAL(18, 2) ,
      @dePorc1 DECIMAL(18, 2) ,
      @dePorc2 DECIMAL(18, 2) ,
      @dePorc3 DECIMAL(18, 2) ,
      @dePorc4 DECIMAL(18, 2) ,
      @dePorc5 DECIMAL(18, 2) ,
      @dePorc6 DECIMAL(18, 2) ,
      @dFecha_Ini SMALLDATETIME,
      @dFecha_Fin SMALLDATETIME,
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
	
        INSERT  INTO saDescCategoria
                ( co_desc, des_des, tip_cli, co_cat, hasta1, hasta2, hasta3, hasta4, hasta5, porc1, porc2, porc3, porc4,
                  porc5, porc6, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
                  fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, Fecha_Ini, Fecha_Fin )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid uniqueidentifier
                INTO @TableTimestamp
        VALUES
                ( @sCo_Desc, @sDes_Des, @sTip_Cli, @sCo_Cat, @deHasta1, @deHasta2, @deHasta3, @deHasta4, @deHasta5,
                  @dePorc1, @dePorc2, @dePorc3, @dePorc4, @dePorc5, @de
```
