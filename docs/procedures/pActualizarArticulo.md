# SP: pActualizarArticulo
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarArticulo
*DESCRIPCIÓN	: Actualiza un Artículo
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarArticulo]
    (
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
      @sdFecha_Reg SMALLDATETIME ,
      @sArt_Des VARCHAR(120) ,
      @sTipo CHAR(1) ,
      @bAnulado BIT ,
      @sdFecha_Inac SMALLDATETIME = NULL ,
      @sCo_Lin CHAR(6) ,
      @sCo_Cat CHAR(6) ,
      @sCo_Subl CHAR(6) ,
      @sCo_Color CHAR(6) ,
      @sCo_Ubicacion CHAR(6) ,
      @sItem VARCHAR(10) = NULL ,
      @sModelo VARCHAR(20) = NULL ,
      @sRef VARCHAR(20) = NULL ,
      @bGenerico BIT ,
      @bManeja_Serial BIT ,
      @bManeja_Lote BIT ,
      @bManeja_Lote_Venc BIT ,
      @deMargen_Min DECIMAL(18, 2) ,
      @deMargen_Max DECIMAL(18, 2) ,
      @sTipo_Imp CHAR(1) ,
      @sTipo_Imp2 CHAR(1) ,
      @sTipo_Imp3 CHAR(1) ,
      @sCo_Reten CHAR(6) = NULL ,
      @sCod_Proc CHAR(6) ,
      @sGarantia VARCHAR(30) ,
      @deVolumen DECIMAL(18, 5) ,
      @dePeso DECIMAL(18, 5) ,
      @deStock_Min DECIMAL(18, 5) ,
      @deStock_Max DECIMAL(18, 5) ,
      @deStock_Pedido DECIMAL(18, 5) ,
      @iRelac_Unidad INT ,
      @dePunt_Ven DECIMAL(18, 2) ,
      @dePunt_Cli DECIMAL(18, 2) ,
      @deLic_Mon_Ilc DECIMAL(18, 2) ,
      @deLic_Capacidad DECIMAL(18, 3) ,
      @deLic_Grado_Al DECIMAL(10, 2) ,
      @sLic_Tipo CHAR(1) = NULL ,
      @bPrec_Om BIT ,
      @sComentario VARCHAR(MAX) = NULL ,
      @sTipo_Cos CHAR(4) = NULL ,
      @dePorc_Margen_Minimo DECIMAL(18, 5) = NULL ,
	  @dePorc_Margen_Maximo DECIMAL(18, 2) = NULL ,
      @deMont_Comi DECIMAL(18, 2) = NULL ,
      @dePorc_Arancel DECIMAL(18, 2) = NULL ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
      @sReten_Iva_Tercero CHAR(16) = NULL ,
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
      @gRowguid
```
