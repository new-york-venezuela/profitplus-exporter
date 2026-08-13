# SP: pActualizarAjustePrecioCostoManual
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoM`](../tables/saAjPrecioCostoM.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE:		pActualizarAjustePrecioCostoManual
*DESCRIPCIÓN :	Actualiza un ajuste
*CREACIÓN:      <2011-12-12>
*MODIFICACIÓN:  <2020-07-27>
*AUTOR:			SOFTECH SISTEMAS
***********************************************************************/
CREATE PROCEDURE [dbo].[pActualizarAjustePrecioCostoManual]
    (
      @sCod_Ajuste CHAR(20) ,
      @sCod_AjusteOri CHAR(20) ,
      @sDes_Ajuste CHAR(50) ,
      @sCo_Alma CHAR(6) ,
      @iTipo_Ajuste CHAR(6) ,
      @sTipo_Ajuste_Precio CHAR(6) ,
      @sTipo_Ajuste_Costo CHAR(6) ,
      @sMargen_Superior CHAR(6) ,
      @sMargen_Inferior CHAR(6) ,
      @sCo_Art_Desde CHAR(30) ,
      @sCo_Art_Hasta CHAR(30) ,
      @sCo_Lin CHAR(6) ,
      @sCo_SubL CHAR(6) ,
      @sCo_Cat CHAR(6) ,
      @sCo_Prov CHAR(16) ,
      @sItem CHAR(10) ,
      @bProcesado BIT ,
      @dFecha DATETIME ,
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
	  -->>JN 20200609
	  , @sCo_Mone CHAR(6) = NULL,
      @deTasa DECIMAL(21, 8) = NULL
	  --<<JN 20200609
	
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
            saAjPrecioCostoM
        SET cod_ajuste = @sCod_Ajuste, des_ajuste = @sDes_Ajuste, co_alma = @sCo_Alma, tipo_ajuste = @iTipo_Ajuste,
            tipo_ajuste_precio = @sTipo_Ajuste_Precio, tipo_ajuste_costo = @sTipo_Ajuste_Costo,
            margen_superior = @sMargen_Superior, margen_inferior = @sMargen_Inferior, co_art_desde = @sCo_Art_Desde,
            co_art_hasta = @sCo_Art_Hasta, co_lin = @sCo_Lin, co_subl = @sCo_SubL, co_cat = @sCo_Cat,
            co_prov = @sCo_Prov, item = @sItem, procesado = @bProcesado, fecha = @dFecha, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCa
```
