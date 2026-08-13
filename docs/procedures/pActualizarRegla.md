# SP: pActualizarRegla
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarRegla
DESCRIPCION: Actualiza una regla de integración
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRegla]
    (
      @sCo_Reg CHAR(10) ,
      @sCo_RegOri CHAR(10) ,
      @sDes_Reg VARCHAR(60) = NULL ,
      @sTipo CHAR(4) ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sCo_Sucu_Mo CHAR(6) ,
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
            ) ;
	
        UPDATE
            saReglaInt
        SET co_reg = @sCo_Reg, des_reg = @sDes_Reg, tipo = @sTipo, inactivo = @bInactivo, debehaber = @iDebeHaber,
            aplica = @sAplica, monto = @sMonto, gasto = @sGasto, distri = @sDistri, descrip = @sDescrip,
            cuenta = @sCuenta, encabezado = @sEncabezado, version = @sVersion, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
```
