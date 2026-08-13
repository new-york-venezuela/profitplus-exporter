# SP: pInsertarRegla
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRegla
DESCRIPCION: Inserta una regla de integración
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRegla]
    (
      @sCo_Reg CHAR(10) ,
      @sDes_Reg VARCHAR(60) = NULL ,
      @sTipo CHAR(4) = NULL ,
      @bInactivo BIT ,
      @iDebeHaber INT ,
      @sAplica VARCHAR(MAX) = NULL ,
      @sMonto VARCHAR(MAX) = NULL ,
      @sGasto VARCHAR(MAX) = NULL ,
      @sDistri VARCHAR(MAX) = NULL ,
      @sDescrip VARCHAR(MAX) = NULL ,
      @sCuenta VARCHAR(MAX) = NULL ,
      @sEncabezado VARCHAR(MAX) = NULL ,
      @sVersion CHAR(4) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL
	
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

        INSERT  INTO saReglaInt
                ( co_reg, des_reg, tipo, inactivo, debehaber, aplica, monto, gasto, distri, descrip, cuenta, encabezado,
                  version, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_sucu_in, co_us_in,
                  fe_us_in, co_us_mo, fe_us_mo, trasnfe, revisado )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Reg, @sDes_Reg, @sTipo, @bInactivo, @iDebeHaber, @sAplica, @sMonto, @sGasto, @sDistri, @sDescrip,
                  @sCuenta, @sEncabezado, @sVersion, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Sucu_In, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELE
```
