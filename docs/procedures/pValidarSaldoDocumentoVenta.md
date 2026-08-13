# SP: pValidarSaldoDocumentoVenta
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2011-12-12>
-- Last Update: <2021-31-05> 
-- Description:	<pValidarSaldoDocumentoVenta>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarSaldoDocumentoVenta]
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
                     dbo.saDocumentoVenta DC
                    LEFT JOIN saFacturaVenta F ON F.doc_num = DC.nro_doc
                                                  AND DC.co_tipo_doc = 'FACT'
                                                  AND DC.aut = 1
                    LEFT JOIN saCobroDocReng PR ON PR.co_tipo_doc = DC.co_tipo_doc
                                                   AND PR.nro_doc = DC.nro_doc
                    LEFT JOIN saCobro PE ON PE.cob_num = PR.cob_num
				--							and  PE.anulado = 0 <MIO 104737>
                  GROUP BY
                    DC.rowguid, DC.anulado, DC.co_tipo_doc, DC.nro_doc, DC.total_neto, DC.Saldo, F.saldo, DC.aut
                ) A
            WHERE
                A.SaldoActual <> A.SaldoReal
                OR A.SaldoFactura <> A.SaldoReal 

        OPEN CURSOR_VALIDAR

        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pCoTipoDoc CHAR(6)
        DECLARE @pNroDoc CHAR(20)
        DECLARE @pSaldoActual DEC
```
