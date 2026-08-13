# SP: pInsertarContabilizacion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarContabilizacion
DESCRIPCION: Dados los datos de una Contabilizacion inserta en la BD este nuevo Contabilizacion.
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarContabilizacion]
    (
      @sInte_Num CHAR(20) ,
      @sdFec_Emis SMALLDATETIME ,
      @sdDesde SMALLDATETIME ,
      @sdHasta SMALLDATETIME ,
      @sdFeccom SMALLDATETIME ,
      @iNumcom INT ,
      @sDes_Inte VARCHAR(60) ,
      @bDocnoint BIT ,
      @bMarcar BIT ,
      @bVal_Cuad BIT ,
      @bCompxfec BIT ,
      @bCompxtip BIT ,
      @iCriterio INT ,
      @iAgrupam INT ,
      @bCompras BIT ,
      @bPagos BIT ,
      @bDev_Pro BIT ,
      @bNcr_Pro BIT ,
      @bNdb_Pro BIT ,
      @bGir_Pro BIT ,
      @bChdev_Pro BIT ,
      @bVentas BIT ,
      @bCobros BIT ,
      @bDev_Cli BIT ,
      @bNcr_Cli BIT ,
      @bNdb_Cli BIT ,
      @bGir_Cli BIT ,
      @bChdev_Cli BIT ,
      @bOrd_Pago BIT ,
      @bMov_Caja BIT ,
      @bMov_Banco BIT ,
      @bAjustes BIT ,
      @bNot_Ent BIT ,
      @bCom_Gen BIT ,
      @bNomina BIT ,
      @bNot_Rec BIT ,
      @bTodos BIT ,
      @bAct_Ultf BIT ,
      @bPlacom BIT ,
      @bPlavent BIT ,
      @bAjupr BIT ,
      @bAjucl BIT ,
      @bTras_Alm BIT ,
      @bPedidos BIT ,
      @bOrdenes BIT ,
      @sCo_Sucu_Desde CHAR(6) ,
      @sCo_Sucu_Hasta CHAR(6) ,
      @sCo_Cont_Desde CHAR(12) ,
      @sCo_Cont_Hasta CHAR(12) ,
      @bAjustexdif BIT ,
      @iOrden INT ,
      @bAuxiliar_Nom BIT ,
      @sCo_Us_In CHAR(6) ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
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
	
        INSERT  INTO saIntegr
                ( Inte_Num, Fec_Emis, Desde, Hasta, Feccom, Numcom, Des_Inte, Docnoint, M
```
