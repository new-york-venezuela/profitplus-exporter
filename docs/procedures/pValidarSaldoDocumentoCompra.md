# SP: pValidarSaldoDocumentoCompra
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <12/12/2011>
-- Modificado:	<2020-07-01>
-- Description:	<Valida el saldo de documentos de compra>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarSaldoDocumentoCompra]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        DECLARE @ValResult TABLE ( Motivo VARCHAR(512) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                *
            FROM
                ( SELECT
                    DC.rowguid, DC.co_tipo_doc, DC.nro_doc, DC.Saldo AS SaldoActual,
                    CASE WHEN DC.anulado = 1 THEN 0.00
                         ELSE DC.total_neto - ISNULL(SUM(CASE WHEN PE.anulado = 1 THEN 0
                                                              ELSE PR.mont_cob
                                                         END), 0.00)
                    END AS SaldoReal,
                    ISNULL(F.saldo, CASE WHEN DC.anulado = 1 THEN 0.00
                                         ELSE DC.total_neto - ISNULL(SUM(CASE WHEN PE.anulado = 1 THEN 0
                                                                              ELSE PR.mont_cob
                                                                         END), 0.00)
                                    END) AS SaldoFactura, DC.aut
                  FROM
                    dbo.saDocumentoCompra DC
                    LEFT JOIN saFacturaCompra F ON F.doc_num = DC.nro_doc
                                                   AND DC.co_tipo_doc = 'FACT'
                                                   AND DC.aut = 1
                    LEFT JOIN saPagoDocReng PR ON PR.co_tipo_doc = DC.co_tipo_doc
                                                  AND PR.nro_doc = DC.nro_doc
                    LEFT JOIN saPago PE ON PE.cob_num = PR.cob_num
                  GROUP BY
                    DC.rowguid, DC.anulado, DC.co_tipo_doc, DC.nro_doc, DC.total_neto, DC.Saldo, F.saldo, Dc.aut
                ) A
            WHERE
                A.SaldoActual <> A.SaldoReal
                OR A.SaldoFactura <> A.SaldoReal

        OPEN CURSOR_VALIDAR

        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pCoTipoDoc CHAR(6)
        DECLARE @pNroDoc CHAR(20)
        DECLARE @pSaldoActual DECIMAL(18, 2)
        DECLARE @pSal
```
