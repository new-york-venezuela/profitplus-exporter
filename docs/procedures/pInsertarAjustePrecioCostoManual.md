# SP: pInsertarAjustePrecioCostoManual
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoM`](../tables/saAjPrecioCostoM.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE :		[pInsertarAjustePrecioCostoManual]
*DESCRIPCIÓN :	Inserta un ajuste de precio/costo manual
*AUTOR :		SOFTECH SISTEMAS
*CREADO:		<2011-12-12>
*MODIFICACION : <2020-06-18>
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarAjustePrecioCostoManual]
    (
      @sCod_Ajuste CHAR(20) ,
      @sDes_Ajuste CHAR(50) ,
      @sCo_Alma CHAR(6) ,
      @iTipo_Ajuste INT ,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
	  -->>JN 20200609
	  @sCo_Mone CHAR(6) = NULL,
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
            )
			
        INSERT  INTO saAjPrecioCostoM
                ( cod_ajuste, des_ajuste, co_alma, tipo_ajuste, tipo_ajuste_precio, tipo_ajuste_costo, margen_superior,
                  margen_inferior, co_art_desde, co_art_hasta, co_lin, co_subl, co_cat, co_prov, item, procesado, fecha,
                  campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in,
                  co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, co_mone, tasa )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Ajuste, @sDes_Ajuste, @sCo_Alma, @iTipo_Ajuste, @sTipo_Ajuste_Precio, @sTipo_Ajuste_Costo,
                  @sMargen_Superior, @sMargen_
```
