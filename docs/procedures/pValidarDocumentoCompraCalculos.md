# SP: pValidarDocumentoCompraCalculos
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saPagoRetenIvaReng`](../tables/saPagoRetenIvaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pValidarDocumentoCompraCalculos
*DESCRIPCIÓN	:	Validarr los calculos en los Documentos de Compras, para validar consistencia
*AUTOR			:	SOFTECH SISTEMAS
*CREATE DATE	:	<2019-11-21>
***************************************************************************/
CREATE PROCEDURE [dbo].[pValidarDocumentoCompraCalculos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pCo_Tipo_Doc CHAR(6)
        DECLARE @pReng_num INT
        DECLARE @pValorOld DECIMAL(18, 5)
        DECLARE @pValorOld2 DECIMAL(18, 5)
        DECLARE @pValorNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Impresa BIT
        DECLARE @CobrosAsociados BIT
        DECLARE @Contabilizada BIT
        DECLARE @Procesada BIT
        DECLARE @bPuedeCorregir BIT
        DECLARE @pSaldo DECIMAL(18, 5)

		DECLARE @diffCalculoImp DECIMAL(18,2) = 0.05

-- ISLR
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                DC.rowguid, DC.nro_doc, DC.co_tipo_doc, DC.total_neto AS ValOri,
                ROUND(ISNULL(SUM(R2.monto_reten), 0), 2) AS ValCalc, DC.saldo,
                CASE WHEN ( DC.total_neto <> DC.saldo ) THEN 1
                     ELSE 0
                END AS cobrosasociados, CASE WHEN ( DC.numcom IS NULL
                                                    AND DC.feccom IS NULL
                                                  ) THEN 0
                                             ELSE 1
                                        END AS contabilizada, R1.mont_cob AS ValOri2
            FROM
                dbo.saPagoDocReng R1
                INNER JOIN dbo.saDocumentoCompra DC ON DC.co_tipo_doc = R1.co_tipo_doc
                                                       AND DC.nro_doc = R1.nro_doc
                LEFT JOIN dbo.saPagoRentenReng R2 ON R1.rowguid = R2.rowguid_reng_cob
            WHERE
                R1.co_tipo_doc IN ( 'ISLR' )
            GROUP BY
                DC.saldo, DC.numcom, DC.feccom, DC.rowguid, DC.co_tipo_doc, DC.nro_doc, R1.mont_cob, DC.total_neto
            HAVING
```
