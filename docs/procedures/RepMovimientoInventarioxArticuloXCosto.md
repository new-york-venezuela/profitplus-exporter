# SP: RepMovimientoInventarioxArticuloXCosto
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <02/09/2011>
-- Description:	<Movimientos de Inventarios por ArticuloXCosto>
-- Update date: <10/09/2013>
-- Description:	<Invocacion a funciones>
-- =============================================
CREATE PROCEDURE [dbo].[RepMovimientoInventarioxArticuloXCosto]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @dCo_fecha_d DATETIME = NULL ,
    @dCo_fecha_h DATETIME = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Movimiento CHAR(4) = NULL ,
    @sCostos CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

             IF ( @sCo_Movimiento IS NULL
             OR @sCo_Movimiento = 'TODO'
           ) 
        SET @sCo_Movimiento = NULL

        SET @dCo_fecha_d = dbo.fechasimple(@dCo_fecha_d)
        SET @dCo_fecha_h = dbo.fechasimple(@dCo_fecha_h)

             Select Art.co_art, ART.art_des, Art.tipo as tipo_art, @sCostos as detalle_costo, 
                    case when @dCo_fecha_d is null or Art.tipo = 'S'
                           then 0.00
                else dbo.ConsultarStockActualxAlmacenxFecha(ART.co_Art,@sCo_Almacen,DATEADD(ss, -1,@dCo_fecha_d),NULL) 
                end as StockInic, AU.co_uni,
                           CASE WHEN A.total_Salida > 0 
                           THEN [dbo].[ObtenerCostoPonderadoSalida](A.rowguidR,null) 
                           ELSE CASE WHEN A.total_entrada > 0 
                                  THEN [dbo].[ObtenerCostoPonderadoEntrada](A.rowguidR,null) 
                                  ELSE 0.00000 END
                           END
                           AS costo_pro,
                           A.co_alma, A.tipo ,A.doc_num,A.reng_num,A.co_cliprov,A.fecha,A.total_entrada,A.total_salida,A.anulado,A.rowguidR,
                           A.total_entrada - ISNULL(CHE.cantidad_usada,0) total_disponibleE, CHE.costo_pro costo_proE,
                           CHS.cantidad total_salidaS, CHS.costo_pro costo_proS, CHS.costo costoSR,
                           CHS.tipo_doc_e, CHS.nro_doc_e, CHS.reng_num_e, CHS.fecha_emision_e,
						   U2.co_uniP1,U2.equivalenciaP1,U2.relacionP1
```
