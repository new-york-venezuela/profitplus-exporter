# SP: pObtenerDocumentosVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDescProntoPago`](../tables/saDescProntoPago.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerDocumentosVenta] ( @sCliente CHAR(16) )
AS 
    BEGIN

        DECLARE @bValidaPagar AS BIT

        SET @bValidaPagar = ( SELECT TOP ( 1 )
                                Cb_Canc_Comp_Ord_Pag
                              FROM
                                par_emp
                            )

        SELECT
            dc.*, dxpp.hasta1 AS Hasta1, dxpp.Hasta2 AS Hasta2, dxpp.Hasta3 AS Hasta3, dxpp.Hasta4 AS Hasta4,
            dxpp.Hasta5 AS Hasta5, dxpp.porc1 AS Porc1, dxpp.porc2 AS porc2, dxpp.porc3 AS porc3, dxpp.porc4 AS porc4,
            dxpp.porc5 AS porc5, dxpp.porc6 AS porc6, dxpp.tip_Cli AS TipoCliente, 
	
	------------
            ( CASE td.tipo_mov
                WHEN 'DE' THEN '+'
                ELSE '-'
              END ) AS signoVsTipo, CAST(( CASE pr.tipo_adi
                                             WHEN 2 THEN 1
                                             ELSE 0
                                           END ) AS BIT) AS esCasaMatriz, CAST(( CASE pr.tipo_adi
                                                                                   WHEN 2 THEN 1
                                                                                   ELSE 0
                                                                                 END ) AS BIT) AS esCasaMatriz,
            ISNULL(( dc.total_neto - dc.monto_imp ), 0) AS Monto_Obj, CAST(0 AS BIT) esPersistente,
            @bValidaPagar AS cobrarParEmp,
            CAST(( CASE WHEN dc.co_tipo_doc = 'FACT' THEN ( (SELECT
                                                                COUNT(fcr.reng_num)
                                                             FROM
                                                                saFacturaVentaReng fcr
                                                             WHERE
                                                                dc.nro_doc = fcr.doc_num)
                                                          )
                        ELSE ( (SELECT
                                    COUNT(dcr.reng_num)
                                FROM
                                    saDocumentoVentaReng dcr
                                WHERE
                                    dc.co_tipo_doc = dcr.co_tipo_doc
                                    AND dc.nro_doc = dcr.nro_doc)
                             )
                   END ) AS BIT) AS existeDocReng, td.apl
```
