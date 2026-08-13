# SP: RepValorActualInventarioPEPSUEPS
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2017-05-15>
-- Description:	<Reporte Para el Valor Actual del Inventario DE PEPS/UEPS>
-- =============================================
CREATE PROCEDURE [dbo].[RepValorActualInventarioPEPSUEPS]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_lin_d CHAR(6) = NULL ,
    @sCo_lin_h CHAR(6) = NULL ,
    @sCo_cat_d CHAR(6) = NULL ,
    @sCo_cat_h CHAR(6) = NULL ,
    @dFecha DATETIME = NULL ,
    @iTasa CHAR(16) = NULL ,
    @sCo_alma CHAR(6) = NULL ,
    @sNivel_Stock CHAR(16) = NULL ,
	@sDetalle CHAR(2) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sNivel_Stock IS NULL ) 
            SET @sNivel_Stock = 'DIFE'

        SET @dFecha = dbo.fechasimple(@dFecha)

        SELECT
            A.*, CASE WHEN @sDetalle = 'SI' OR @sDetalle IS NULL THEN 'SI' ELSE 'NO' END AS  detalle 
        FROM
            ( SELECT DISTINCT
                ART.co_art, ART.art_des, CHE.cod_almacen, CHE.cantidad, CHE.rengNum,
				(CHE.cantidad_usada - ISNULL(CHS.CantidadAExcluir, 0)) AS cantidad_usada, --Sit# 806958 ZPEREZ
				CHE.costo, CHE.costo_pro, 
                CHE.tipo_doc, 
				CHE.cantidad - (CHE.cantidad_usada - ISNULL(CHS.CantidadAExcluir, 0)) AS Calculo, --Sit# 806958 ZPEREZ
				CASE CHE.tipo_doc
                    WHEN 'AJUS' THEN DOCE01.ajue_num
                    WHEN 'TRAS' THEN DOCE02.tras_num
                    WHEN 'GCOM' THEN DOCE03.gene_num
                    WHEN 'COMP' THEN DOCE04.doc_num
                    WHEN 'NREC' THEN DOCE05.doc_num
                    WHEN 'DCLI' THEN DOCE06.doc_num
                    ELSE NULL
                END AS nro_doc, '' AS reng_num,
                CHE.fecha_emision AS fecha_emision, AU.co_uni
              FROM
                saCostoHistoricoEntrada CHE 
                LEFT JOIN saArticulo ART ON ART.rowguid = CHE.cod_articulo_rowguid
                LEFT JOIN saAjusteReng DOCE01 ON DOCE01.rowguid = CHE.doc_orig
                LEFT JOIN saTrasladoReng DOCE02 ON DOCE02.rowguid = CHE.doc_orig
                LEFT JOIN saArtCompuestoGen DOCE03 ON DOCE03.rowguid = CHE.doc_orig
                LEFT JOIN saFacturaCompraReng DOCE04 ON DOCE04.rowguid = CHE.doc
```
