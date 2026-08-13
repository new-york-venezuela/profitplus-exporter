# SP: RepTotalVentaxArticulo
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Ventas por Artículo>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalVentaxArticulo]
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)
	   
	  
        SELECT
            A.co_art, A.art_des, AN.co_uni, AN.des_uni, FR.doc_num, FR.total_art, FR.otros, FR.iva, F.fec_emis,
            ROUND(( FR.prec_vta - FR.monto_desc - FR.monto_desc_glob + FR.monto_reca_glob ), 5) AS monto_base,
            '0.00' AS total_dev, '0.00' AS monto_base_dev, '0.00' AS otros_dev, '0.00' AS iva_dev,
            F.Campo1,
            F.Campo2,
            F.Campo3,
            F.Campo4,
            F.Campo5,
            F.Campo6,
            F.Campo7,
            F.Campo8
            
        FROM
            saArticulo AS A
            INNER JOIN ( SELECT
                            co_art, doc_num, co_uni, SUM(prec_vta * total_art) AS prec_vta,
                            SUM(monto_desc) AS monto_desc, SUM(monto_desc_glob) AS monto_desc_glob,
                            SUM(monto_reca_glob) AS monto_reca_glob,
                            SUM(dbo.ArtUnidadBase(co_art, co_uni, total_art)) AS total_art,
                            ROUND(( SUM(otros1_glob) + SUM(otros2_glob) + SUM(otros3_glob) ), 5) AS otros,
                            ROUND(( SUM(monto_imp) + SUM(monto_imp_afec_glob) ), 5) AS iva
                         FROM
                            saFacturaVentaReng
                         GROUP BY
                            co_art, doc_num, co_uni, total_art
                       ) AS FR ON FR.co_art = A.co_art
            INNER JOIN saFa
```
