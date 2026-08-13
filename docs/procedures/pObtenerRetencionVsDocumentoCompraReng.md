# SP: pObtenerRetencionVsDocumentoCompraReng
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraInfoIGTF`](../tables/saDocumentoCompraInfoIGTF.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerRetencionVsDocumentoCompraReng]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6)
    )
AS 
    BEGIN


        IF @sCo_Tipo_Doc = 'FACT' 
            BEGIN
                SELECT
                    ISNULL(a.co_reten, ISNULL(la.co_reten, ISNULL(sl.co_reten, ca.co_reten))) AS co_islr,
                    --SUM(ISNULL(dcr.reng_neto, 0) - ISNULL(dcr.monto_desc_glob, 0) + ISNULL(dcr.monto_reca_glob, 0)) AS monto,
					SUM(ISNULL(dcr.reng_neto, 0) - ISNULL(dcr.monto_desc_glob, 0) + ISNULL(dcr.monto_reca_glob, 0) + ISNULL(dcr.otros2_glob, 0)+ISNULL(dcr.otros3_glob, 0) + case when (ISNULL( dvig.base_imponible,0)>0)then 0 else ISNULL(dcr.otros1_glob, 0) end ) AS monto, --DN30052022
                    CONVERT(BIT, 1) automatica
                FROM
                    saFacturaCompraReng dcr
                    INNER JOIN saArticulo a ON dcr.co_art = a.co_art
                    INNER JOIN saLineaArticulo la ON la.co_lin = a.co_lin
                    INNER JOIN saSubLinea sl ON sl.co_subl = a.co_subl  AND la.co_lin = sl.co_lin
                    INNER JOIN saCatArticulo ca ON ca.co_cat = a.co_cat
                    INNER JOIN saDocumentoCompra dc ON dc.nro_doc = dcr.doc_num
					left join  saDocumentoCompraInfoIGTF dvig on dc.rowguid = dvig.rowguid -- DN 30052022
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
                    ISNULL(a.co_reten, ISNULL(la.co_reten, ISNULL(sl.co_reten, ca.co_reten))) 
            END
        ELSE 
            BEGIN
                SELECT
                    ISNULL(la.co_reten, ISNULL(sl.co_reten, ISNULL(ca.co_reten, a.co_reten))) AS co_islr,
                    SUM(ISNULL(dcr.reng_neto, 0)) AS monto, CONVERT(BIT, 1) automatica
                FROM
                    saDocumentoCompraReng dcr
                    INNER JOIN saArticulo a ON dcr.co_art = a.co_art
                    INNER JOIN saLineaArticulo la ON la.co_lin = a.co_lin
                    INNER JOIN saSubLinea sl ON sl.co_subl = a.co_subl
                    INNER JOIN saCatArticulo ca ON ca.co_cat = a.co_cat
                    I
```
