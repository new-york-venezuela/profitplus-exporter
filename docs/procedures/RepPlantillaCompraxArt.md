# SP: RepPlantillaCompraxArt
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Plantillas de Compra por Artículos>
-- =============================================
CREATE PROCEDURE [RepPlantillaCompraxArt]
    @cCo_Articulo_d CHAR(30) = NULL ,
    @cCo_Articulo_h CHAR(30) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Prov_d CHAR(16) = NULL ,
    @cCo_Prov_h CHAR(16) = NULL ,
    @cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Almacen_d CHAR(6) = NULL ,
    @cCo_Almacen_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)  
     


-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, ART.art_des, ART.modelo, ART.co_lin, ART.co_subl, ART.co_cat, FC.doc_num,
            FC.nro_fact, FC.descrip, FC.co_prov, FC.co_mone, FC.co_cond, FC.porc_desc_glob, FC.porc_reca, FC.status,
            FC.n_control, FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.tasa, 
			FC.total_bruto, 


			FC.total_neto / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                   ELSE FC.tasa
                              END ) AS total_neto, FC.saldo / ( CASE WHEN @cCo_Moneda IS NULL THEN 1
                                                                     ELSE FC.tasa
                                                                END ) AS saldo,


            FC.monto_desc_glob, FC.monto_reca, FC.otros1, FC.otros2, FC.otros3, FC.monto_imp, FC.monto_imp2,
            FC.monto_imp3, FC.anulado, FC.impresa, /*FC.seriales_e,*/ FC.salestax, FC.dis_cen, FC.feccom, FC.numcom,
            FC.dir_ent, FC.comentario, FC.campo1, FC.
```
