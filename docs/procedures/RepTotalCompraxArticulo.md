# SP: RepTotalCompraxArticulo
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Compras por Artículo>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCompraxArticulo]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
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
      
        
        SELECT
            A.co_art, A.art_des, UN.co_uni, UN.des_uni, FR.total_art, '0.00' AS total_dev, FR.doc_num, FR.otros, FR.iva,
            F.fec_emis,
        --ROUND((FR.cost_unit* FR.total_art) - FR.monto_desc - FR.monto_desc_glob + FR.monto_reca_glob),2) AS monto_base,
            ROUND(( FR.cost_total - FR.monto_desc - FR.monto_desc_glob + FR.monto_reca_glob ), 2) AS monto_base,
            '0.00' AS monto_base_dev, '0.00' AS otros_dev, '0.00' AS iva_dev
        FROM
            saArticulo AS A
            INNER JOIN ( SELECT
                            co_art, doc_num, co_uni,
		--SUM(cost_unit) as cost_unit,SUM(monto_desc)as monto_desc,SUM(monto_desc_glob)as monto_desc_glob,SUM(monto_reca_glob)as monto_reca_glob,
                            SUM(cost_unit * total_art) AS cost_total, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_reca_glob,
                            SUM(dbo.artunidadbase(co_ART, CO_UNI, total_art)) AS total_art,
                            ROUND(( SUM(otros1_glob) + SUM(otros2_glob) + SUM(otros3_glob) ), 5) AS otros,
                            ROUND(( SUM(monto_imp) + SUM(monto_imp_afec_glob) ), 5) AS iva
                         FROM
                            saFacturaCompraReng
                         GROUP BY
                            co_art, doc_num, co_uni,
```
