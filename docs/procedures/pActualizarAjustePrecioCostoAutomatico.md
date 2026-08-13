# SP: pActualizarAjustePrecioCostoAutomatico
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoAuto`](../tables/saAjPrecioCostoAuto.md)

## Código (excerpt)
```sql
/**********************************************************************
AUTOR:			 SOFTECH SISTEMAS
DATE CREATE:     2011-12-12
LASTDATE UPDATE: 2020-07-27
NOMBRE:			 pActualizarAjustePrecioCostoAutomatico
DESCRIPCIÓN :	 Actualiza un ajuste de precio o costo automatico
***********************************************************************/

CREATE PROCEDURE [dbo].[pActualizarAjustePrecioCostoAutomatico]
    (
      @sCod_Ajuste CHAR(20) ,
      @sCod_AjusteOri CHAR(20) ,
      @sDes_Ajuste CHAR(50) ,
      @sCo_Alma CHAR(6) = NULL ,
      @iTipo_Ajuste INT ,
      @sTipo_Ajuste_Precio CHAR(6) = NULL ,
      @sTipo_Ajuste_Costo CHAR(6) = NULL ,
      @sMargen_Superior CHAR(6) ,
      @sMargen_Inferior CHAR(6) ,
      @sCo_Art_Desde CHAR(30) = NULL ,
      @sCo_Art_Hasta CHAR(30) = NULL ,
      @sCo_Lin_Desde CHAR(6) = NULL ,
      @sCo_Lin_Hasta CHAR(6) = NULL ,
      @sCo_SubL_Desde CHAR(6) = NULL ,
      @sCo_SubL_Hasta CHAR(6) = NULL ,
      @sCo_Cat_Desde CHAR(6) = NULL ,
      @sCo_Cat_Hasta CHAR(6) = NULL ,
      @sCo_Prov_Desde CHAR(16) = NULL ,
      @sCo_Prov_Hasta CHAR(16) = NULL ,
      @sItem_Desde CHAR(10) = NULL ,
      @sItem_Hasta CHAR(10) = NULL ,
      @dVigencia_Desde DATETIME = NULL ,
      @dVigencia_Hasta DATETIME = NULL ,
      @bProcesado BIT ,
      @dFecha DATETIME ,
      @iMetodo INT = NULL ,
      @iTipo_Calculo INT = NULL ,
      @deValor DECIMAL(18, 5) ,
	  @deFactor DECIMAL(18, 5) ,
      @bRedondeo BIT ,
      @iTipo_Redondeo INT = NULL ,
      @sValor_Redondeo CHAR(4) = NULL ,
      @sCondicion1 CHAR(4) = NULL ,
      @sCondicion2 CHAR(4) = NULL ,
      @deValor_Condicion1 DECIMAL(18, 5) = NULL ,
      @deValor_Condicion2 DECIMAL(18, 5) = NULL ,
      @iOperador_Logico INT = NULL ,
	  @bBasado_En BIT ,
	  @sBasado_En_Costo CHAR(4) = NULL ,
	  @dBasado_En_Fecha DATETIME = NULL ,
	  @sBasado_En_Co_Alma CHAR(6) = NULL ,
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
      @gRowguid UNIQUEIDENTIFIER
```
