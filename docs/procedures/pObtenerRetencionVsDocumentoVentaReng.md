# SP: pObtenerRetencionVsDocumentoVentaReng
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerRetencionVsDocumentoVentaReng]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN


        IF @sCo_Tipo_Doc = 'FACT' 
            BEGIN
                SELECT
                    ISNULL(la.co_reten, ISNULL(sl.co_reten, ISNULL(ca.co_reten, a.co_reten))) AS co_islr,
                    --SUM(ISNULL(dcr.reng_neto, 0) - ISNULL(dcr.monto_desc_glob, 0) + ISNULL(dcr.monto_reca_glob, 0)+ ISNULL(dcr.otros1_glob, 0)) AS monto,
					SUM(ISNULL(dcr.reng_neto, 0) - ISNULL(dcr.monto_desc_glob, 0) + ISNULL(dcr.monto_reca_glob, 0) + ISNULL(dcr.otros2_glob, 0)+ISNULL(dcr.otros3_glob, 0) + case when (ISNULL( dvig.base_imponible,0)>0)then 0 else ISNULL(dcr.otros1_glob, 0) end ) AS monto, --DN24052022
                    CONVERT(BIT, 1) automatica
                FROM
                    saFacturaVentaReng dcr
                    INNER JOIN saArticulo a ON dcr.co_art = a.co_art
                    INNER JOIN saLineaArticulo la ON la.co_lin = a.co_lin
                    INNER JOIN saSubLinea sl ON sl.co_subl = a.co_subl  AND la.co_lin = sl.co_lin
                    INNER JOIN saCatArticulo ca ON ca.co_cat = a.co_cat
                    INNER JOIN saDocumentoVenta dc ON dc.nro_doc = dcr.doc_num
					left join  saDocumentoVentaInfoIGTF dvig on dc.rowguid = dvig.rowguid -- DN 24052022
                WHERE
                    ( la.co_reten IS NOT NULL
                      OR sl.co_reten IS NOT NULL
                      OR ca.co_reten IS NOT NULL
                      OR a.co_reten IS NOT NULL
                    )
                    AND ( dc.co_tipo_doc = @sCo_Tipo_Doc
                          AND dc.nro_doc = @sNro_Doc
                        )
                GROUP BY
                    ISNULL(la.co_reten, ISNULL(sl.co_reten, ISNULL(ca.co_reten, a.co_reten))) 
            END
        ELSE 
            BEGIN
                SELECT
                    ISNULL(la.co_reten, ISNULL(sl.co_reten, ISNULL(ca.co_reten, a.co_reten))) AS co_islr,
                    SUM(ISNULL(dcr.reng_neto, 0)) AS monto, CONVERT(BIT, 1) automatica
                FROM
                    saDocumentoVentaReng dcr
                    INNER JOIN saArticulo a ON dcr.co_art = a.co_art
                    INNER JOIN saLineaArticulo la ON la.co_lin = a.co_lin
                    INNER JOIN saSubLinea sl ON sl.co_subl = a.co_subl
                    INNER JOIN saCatArticulo ca ON ca.co_cat = a.co_cat
```
