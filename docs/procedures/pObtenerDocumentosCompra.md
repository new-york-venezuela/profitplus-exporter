# SP: pObtenerDocumentosCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerDocumentosCompra] ( @sProveedor CHAR(16) )
AS 
    BEGIN

        DECLARE @bValidaPagar AS BIT

        SET @bValidaPagar = ( SELECT TOP ( 1 )
                                Cb_Canc_Comp_Ord_Pag
                              FROM
                                par_emp
                            )

        SELECT
            dc.*, ( CASE td.tipo_mov
                      WHEN 'DE' THEN '+'
                      ELSE '-'
                    END ) AS signoVsTipo, CAST(( CASE pr.tipo_adi
                                                   WHEN 2 THEN 1
                                                   ELSE 0
                                                 END ) AS BIT) AS esCasaMatriz, CAST(( CASE pr.tipo_adi
                                                                                         WHEN 2 THEN 1
                                                                                         ELSE 0
                                                                                       END ) AS BIT) AS esCasaMatriz,
            ISNULL(( dc.total_neto - dc.monto_imp - dc.otros1 - dc.otros2 - dc.otros3 ), 0) AS Monto_Obj,
            CAST(0 AS BIT) esPersistente, @bValidaPagar AS pagarParEmp,
            CAST(( CASE WHEN dc.co_tipo_doc = 'FACT' THEN ( (SELECT
                                                                COUNT(fcr.reng_num) z
                                                             FROM
                                                                saFacturaCompraReng fcr
                                                             WHERE
                                                                dc.nro_doc = fcr.doc_num)
                                                          )
                        ELSE ( (SELECT
                                    COUNT(dcr.reng_num)
                                FROM
                                    saDocumentoCompraReng dcr
                                WHERE
                                    dc.co_tipo_doc = dcr.co_tipo_doc
                                    AND dc.nro_doc = dcr.nro_doc)
                             )
                   END ) AS BIT) AS ExisteDocReng, td.aplica_dxpp_compra, td.aplica_riva_compra,
            [dbo].[ExistePagoRetencionDocumentoCompra](dc.co_tipo_doc, dc.nro_doc, 1, NULL) AS ExistePagoRetenIva, --Ya existe un pago para el documento en el cual se realizao una retención de IVA
```
