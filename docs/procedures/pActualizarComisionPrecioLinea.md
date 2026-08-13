# SP: pActualizarComisionPrecioLinea
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioLinea`](../tables/saComisionPrecioLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarComisionNivelLinea
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarComisionPrecioLinea]
    (
      @sCo_Comip CHAR(6) ,
      @sCo_ComipOri CHAR(6) ,
      @sDes_Comip VARCHAR(60) ,
      @sTipo_Ven CHAR(1) ,
      @sAplica_En CHAR(1) ,
      @sCo_Precio CHAR(6) ,
      @sCo_Lin CHAR(6) ,
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
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_sucu_mo CHAR(6) ,
      @sCo_us_mo CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
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
            saComisionPrecioLinea
        SET co_comip = @sCo_Comip, des_comip = @sDes_Comip, tipo_ven = @sTipo_Ven, aplica_en = @sAplica_En, 
            co_precio = @sCo_Precio, co_lin = @sCo_Lin, hasta1 = @deHasta1, hasta2 = @deHasta2, hasta3 = @deHasta3, 
            hasta4 = @deHasta4, hasta5 = @deHasta5, porc1 = @dePorc1, porc2 = @dePorc2, porc3 = @dePorc3, 
            porc4 = @dePorc4, porc5 = @dePorc5, porc6 = @dePorc6, campo1 = @sCampo1, campo2 = @sCampo2, 
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, 
            campo8 = @sCampo8, co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE(), 
            revisado = @sRevisado, trasnf
```
