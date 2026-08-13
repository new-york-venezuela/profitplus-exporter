# SP: pv_ObtenerFactVtaRenglon
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerFactVtaRenglon]
*DESCRIPCIÓN	: OBTIENE LOS RENGLONES DE UNA FACTURA DADA QUE NO ESTE ANULADA
*CREATE DATE    : 2013/09/09
*LAST UPDATE    : 2018/07/10
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerFactVtaRenglon]
(
      @sDocNum CHAR(20)
)
AS
BEGIN
                  SELECT FAR.reng_num, 
                                   FAR.co_art, 
                                   --ART.art_des,
                                   case when convert(char,FAR.des_art) <> '' then convert(char,FAR.des_art) else  ART.art_des end as art_des, 
                                   FAR.total_art,
                                   FAR.co_alma, 
                                   FAR.co_uni, 
                                   FAR.co_precio, 
                                   FAR.prec_vta, 
                                   FAR.reng_neto, 
                                   FAR.tipo_imp, 
                                   ISNULL(FAR.porc_desc, '0.00+0.00+0.00') AS porc_desc, 
                                   FAR.monto_desc, 
                                   FAR.co_alma, 
                                   FAR.total_dev, 
                                   FAR.comentario,
                                   FAR.pendiente, 
                                   FAR.porc_imp,
                                   FAR.monto_imp, 
                                   FAR.monto_imp_afec_glob,
                                   FAR.monto_desc_glob,
                                   FAR.monto_reca_glob,
                                   FAC.porc_desc_glob,
                                   FAC.porc_reca,
                                   FAR.otros1_glob, 
                                   FAR.otros2_glob,
                                   FAR.otros3_glob,
                                   FAR.rowguid,
                                   ISNULL(EXT.estado, 'X') as estado
                  FROM saFacturaVentaReng AS FAR 
                                   INNER JOIN saFacturaVenta AS FAC ON FAR.doc_num = FAC.doc_num 
                                   INNER JOIN saArticulo AS ART ON FAR.co_art = ART.co_art
                                   LEFT JOIN pvFacturaVentaExt as EXT on EXT.rowguid_doc_num = FAC.rowguid
                  WHERE FAC.doc_num = @sDo
```
