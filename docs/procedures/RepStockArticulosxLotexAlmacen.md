# SP: RepStockArticulosxLotexAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		<Softech Sistemas
 Create date:   <22-07-10>
 Description:	<Articulos con su Stock por Lote>
 =============================================*/
CREATE PROCEDURE [dbo].[RepStockArticulosxLotexAlmacen]
	-- Add the parameters for the stored procedure here
    @sCo_Codigo_d CHAR(30) = NULL ,
    @sCo_Codigo_h CHAR(30) = NULL ,
    @sCo_Descripcion_d CHAR(120) = NULL ,
    @sCo_Descripcion_h CHAR(120) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_SubLinea_d CHAR(6) = NULL ,
    @sCo_SubLinea_h CHAR(6) = NULL ,
    @sCo_Almacen_d CHAR(6) = NULL ,
    @sCo_Almacen_h CHAR(6) = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Uni CHAR(6) = NULL ,
    @sTipoStock CHAR(4) = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
    @sCo_NumeroLote_d CHAR(20) = NULL ,
    @sCo_NumeroLote_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        DECLARE @bObtenerUnidadPrincipal BIT ;

---------------Valores por Defecto-------------------
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_alma'

                                    
        IF @sCo_NivelStock IS NULL 
            SET @sCo_NivelStock = 'DIFE' 
--------------Fin Valores por Defecto----------------
        DECLARE @sCo_fecha_h DATETIME
        SET @sCo_fecha_h = GETDATE() 

        SET @sCo_fecha_h = dbo.fechasimple(@sCo_fecha_h)


		
SELECT * FROM
  (
        SELECT DISTINCT  TOP 10000 
            A.co_art,A.fecha_reg,A.art_des,A.tipo,A.anulado,A.fecha_inac,A.co_lin,A.co_subl,A.co_cat,A.co_color,A.co_ubicacion,
			A.cod_proc,A.item,A.modelo,A.ref,A.generico,A.maneja_serial,A.maneja_lote,A.maneja_lote_venc,A.margen_min,A.margen_max,
			A.tipo_imp,A.tipo_imp2,A.tipo_imp3,A.co_reten,A.garantia,A.volumen,A.peso,A.stock_min,A.stock_max,A.stock_pedido,A.relac_unidad,
			A.punt_ven,A.punt_cli,A.lic_mon_ilc,A.lic_capacidad,A.lic_grado_al,A.lic_tipo,A.prec_om,A.comentario,A.tipo_cos,
			A.porc_margen_minimo,A.mont_comi,A.porc_arancel,A.numcom,A.feccom,--A.dis_cen,
			A.reten_iva_tercero,A.campo1,A.campo2,
			A.campo3,A.campo4,A.campo5,A.campo6,A
```
