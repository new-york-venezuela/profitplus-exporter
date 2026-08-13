# SP: pInsertarComisionPrecioCategoria
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioCategoria`](../tables/saComisionPrecioCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarComisionPrecioCategoria
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarComisionPrecioCategoria]
    (
      @sCo_Comip CHAR(6) ,
      @sDes_Comip VARCHAR(60) ,
      @sTipo_Ven CHAR(1) ,
      @sAplica_En CHAR(1),
      @sCo_Precio CHAR(6) ,
      @sCo_Cat CHAR(6) ,
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
      @sCo_Us_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Sucu_In CHAR(6)
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
		
		
        INSERT  INTO saComisionPrecioCategoria
                ( co_comip, des_comip, tipo_ven, aplica_en, co_precio, co_cat, hasta1, hasta2, hasta3, hasta4, hasta5, porc1, porc2,
                  porc3, porc4, porc5, porc6, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in,
                  fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Comip, @sDes_Comip, @sTipo_Ven, @sAplica_En, @sCo_Precio, @sCo_Cat, @deHasta1, @deHasta2, @deHasta3, @deHasta4,
                  @deHasta5, @dePorc1, @dePorc2, @dePorc3, @dePorc4, @dePorc5, @dePorc6, @sCampo1, @sCampo2, @sCampo3,
                  @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, GETDATE()
```
