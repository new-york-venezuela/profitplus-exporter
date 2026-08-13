# SP: RepTotalCotizacionProveedorxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalCotizacionProveedorxArticulo]
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
    @sOperacion CHAR(20) = NULL ,
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


        SET @sOperacion = 'coti'

        SELECT
            @sOperacion AS Operacion, CPR.doc_num, CP.fec_emis, CPR.monto_imp, CP.total_neto, CPR.otros1, CPR.otros2,
            CPR.otros3, CP.total_bruto, CP.monto_reca, CP.monto_desc_glob, CPR.co_art, AU.co_uni,
            ( CPR.otros1 + CPR.otros2 + CPR.otros3 ) AS otros,
            ROUND(dbo.ArtUnidadBase(CPR.co_art, CPR.co_uni, CPR.total_art), 2) AS total_art,
            ROUND(dbo.ArtUnidadBase(CPR.co_art, CPR.co_uni, CPR.pendiente), 2) AS pendiente,
            ROUND(( CPR.cost_vta - CPR.monto_desc - CPR.monto_desc_glob + CPR.monto_reca_glob ), 2) AS monto_base,
            A.art_des
        FROM
            saCotizacionProveedor AS CP --INNER JOIN saCotizacionProveedorReng AS CPR ON CPR.doc_num = CP.doc_num
            INNER JOIN ( SELECT
                            doc_num, /*max(*/ co_art/*) as co_art*/, MAX(co_uni) AS co_uni, SUM(cost_unit) AS cost_unit,
                            SUM(cost_unit * total_art) AS cost_vta, SUM(total_art) AS total_art,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_reca_glob,
                            SUM(pendiente) AS pendiente, SUM(otros1_glob) AS otros1, SUM(otros2_glob) AS otros2,
```
