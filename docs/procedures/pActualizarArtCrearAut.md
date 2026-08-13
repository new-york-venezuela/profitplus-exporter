# SP: pActualizarArtCrearAut
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCrearAut`](../tables/saArtCrearAut.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarArtCrearAut
*DESCRIPCIÓN	: actualiza una plantilla de generación de Artículos
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pActualizarArtCrearAut]
    (
      @sCo_ArtCrearAut CHAR(30) ,  
      @sCo_ArtCrearAutOri CHAR(30) ,  
      @stipo CHAR(30),   
      @sdFecha_Reg SMALLDATETIME ,
      @sArtCrearAut_Des VARCHAR(120) , 
      @sArt_Des VARCHAR(120) = NULL,
      @sCo_Lin_Desde CHAR(6) = NULL,
      @sCo_Subl_Desde CHAR(6) = NULL,
      @sCo_Cat_Desde CHAR(6) = NULL,
      @sCo_Color_Desde CHAR(6) = NULL,
      @sCo_Ubicacion_Desde CHAR(6) = NULL ,
      @sCo_Alma CHAR(6) ,
      @sCo_Lin_Hasta CHAR(6) ,
      @sCo_Subl_Hasta CHAR(6) ,
      @sCo_Cat_Hasta CHAR(6) ,
      @sCo_Uni CHAR(6) ,
      @sCo_Color_Hasta CHAR(6) ,
      @sCo_Ubicacion_Hasta CHAR(6) ,
      @sItem_Desde VARCHAR(10) = NULL ,      
      @sItem_Hasta VARCHAR(10) = NULL ,
      @sRef VARCHAR(20) = NULL ,
      @bManeja_Serial BIT ,
      @bProcesado BIT ,
      @iDesc_Art_Libre INT ,
      @bUsar_Cod_artLin BIT ,
      @bUsar_Cod_artSubl BIT ,
      @bUsar_Cod_artCat BIT ,
      @bUsar_Cod_artColor BIT ,
      @bUsar_Cod_artUbicacion BIT ,
      @bUsar_Cod_artProc BIT ,
      @bUsar_Cod_artItem BIT ,
      @bManeja_Lote BIT ,
      @iLong_Cod_artLin INT ,
      @iLong_Cod_artSubl INT ,
      @iLong_Cod_artCat INT ,
      @iLong_Cod_artColor INT ,
      @iLong_Cod_artUbicacion INT ,
      @iLong_Cod_artProc INT ,
      @iLong_Cod_artItem INT ,      
      @iOrden_Cod_artLin INT ,      
      @iOrden_Cod_artSubl INT ,      
      @iOrden_Cod_artCat INT ,      
      @iOrden_Cod_artColor INT ,      
      @iOrden_Cod_artUbicacion INT ,      
      @iOrden_Cod_artProc INT ,      
      @iOrden_Cod_artItem INT ,
      @bManeja_Lote_Venc BIT ,
      @sTipo_Imp CHAR(1) ,
      @sTipo_Imp2 CHAR(1) ,
      @sTipo_Imp3 CHAR(1) ,
      @sCo_Reten CHAR(6) = NULL ,
      @sCo_Proc_Desde CHAR(6) ,      
      @sCo_Proc_Hasta CHAR(6) ,
      @sGarantia VARCHAR(30) ,
      @deVolumen DECIMAL(18, 5) ,
      @dePeso DECIMAL(18, 5) ,
      @deStock_Min DECIMAL(18, 5) ,
      @deStock_Max DECIMAL(18, 5) ,
      @deStock_Pedido DECIMAL(18, 5) ,
      @bPrec_Om BIT ,
      @sComentario VARCHAR(MAX) = NULL ,
      @sTipo_Cos CHAR(4) = NULL ,
      @d
```
