# SP: pActualizarDescuentoLinea
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saDescLinea`](../tables/saDescLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarDescuento
DESCRIPCION: Actualiza un registro en las tablas descuento de acuerdo al contexto
CREADO POR: SOFTECH SISTEMAS.
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarDescuentoLinea]
    (
      @sCo_Desc CHAR(6) = NULL ,
      @sDes_Des VARCHAR(60) = NULL ,
      @sCo_DescOri CHAR(6) = NULL ,
      @sCo_Lin CHAR(6) = NULL ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Cat CHAR(6) = NULL ,
      @sTip_Cli CHAR(6) = NULL ,
      @deHasta1 DECIMAL(18, 2) ,
      @deHasta2 DECIMAL(18, 2) ,
      @deHasta3 DECIMAL(18, 2) ,
      @deHasta4 DECIMAL(18, 2) ,
      @deHasta5 DECIMAL(18, 2) ,
      @dFecha_Ini SMALLDATETIME,      
      @dFecha_Fin SMALLDATETIME,
      @dePorc1 DECIMAL(18, 2) ,
      @dePorc2 DECIMAL(18, 2) ,
      @dePorc3 DECIMAL(18, 2) ,
      @dePorc4 DECIMAL(18, 2) ,
      @dePorc5 DECIMAL(18, 2) ,
      @dePorc6 DECIMAL(18, 2) ,
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
            saDescLinea
        SET co_lin = @sCo_Lin, des_des = @sDes_Des, tip_cli = @sTip_Cli, hasta1 = @deHasta1, hasta2 = @deHasta2,
            hasta3 = @deHasta3, hasta4 = @deHasta4, hasta5 = @deHasta5, porc1 = @dePorc1, porc2 = @dePorc2,
            porc3 = @dePorc3, porc4 = @dePorc4, porc5 = @dePorc5, porc6 = @dePorc6, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @
```
