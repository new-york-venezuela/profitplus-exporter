# SP: pValidarNotaDespachoVentaCalculos
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <18/11/2009>
-- Last Update date: 2017-07-31
-- Description:	<Valida la consistencia de las Notas de Despacho>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarNotaDespachoVentaCalculos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER 
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pValorOld DECIMAL(18, 5)
        DECLARE @pValorNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Impresa BIT
        DECLARE @CobrosAsociados BIT
        DECLARE @Contabilizada BIT
        DECLARE @Procesada BIT
		DECLARE @DocAnulado VARCHAR(10)
		DECLARE @Anulado BIT

        DECLARE @bPuedeCorregir BIT

				DECLARE @diffCalculoImp DECIMAL(4,2) = 0.05;

	-- Total Bruto (Versus renglones)
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                E.rowguid, E.doc_num, E.total_bruto AS ValOri, SUM(R.reng_neto) AS ValCalc, E.impresa,
                CASE WHEN ( E.total_neto <> E.saldo ) THEN 1
                     ELSE 0
                END AS cobrosasociados, CASE WHEN ( E.numcom IS NULL
                                                    AND E.feccom IS NULL
                                                  ) THEN 0
                                             ELSE 1
                                        END AS contabilizada, CASE WHEN ( E.status <> 0 ) THEN 1
                                                                   ELSE 0
                                                              END AS procesada,
										CASE WHEN E.anulado = 1 THEN '(Anulado)' ELSE '' END docAnulado, E.anulado
            FROM
                saNotaDespachoVenta E
                INNER JOIN saNotaDespachoVentaReng R ON e.doc_num = R.doc_num
            GROUP BY
                E.rowguid, E.doc_num, E.total_bruto, E.impresa, E.total_neto, E.saldo, E.numcom, E.feccom, E.status, E.anulado
            HAVING
                E.total_bruto <> SUM(R.reng_neto)
            ORDER BY
                2

        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INT
```
