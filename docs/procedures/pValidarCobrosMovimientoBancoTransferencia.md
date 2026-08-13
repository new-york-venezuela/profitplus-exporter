# SP: pValidarCobrosMovimientoBancoTransferencia
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:				SOFTECH SISTEMAS
-- Create date:			<04-08-2015>
-- Last Update Date	:	2017-07-21
-- Description:	<pValidarCobrosMovimientoBancoTransferencia>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarCobrosMovimientoBancoTransferencia]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
	
        DECLARE @pIdR UNIQUEIDENTIFIER
        DECLARE @pIdM UNIQUEIDENTIFIER
        DECLARE @pReng_Num INT
        DECLARE @pCob_Num CHAR(20)
        DECLARE @pConciliado BIT
		DECLARE @pContabilizado BIT
		DECLARE @pTasa DECIMAL(18, 5)
		DECLARE @pCo_Cta_Ingr_Egr CHAR(20)
		DECLARE @pFecha SMALLDATETIME
		DECLARE @pValor INT
		DECLARE @pMotivo VARCHAR (256)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

	-- Coincidencia formas de Cobro con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            --Validar Movimiento Anulado. Valor 0
				SELECT
                MV.rowguid AS IdM, RP.cob_num, RP.reng_num, MV.conciliado,
						CASE WHEN MV.numcom <> 0 AND MV.feccom > '01-01-1900' 
                                THEN
                                1
                                ELSE
								0
                                END
                                AS contabilizado,
								null AS Tasa,
								null AS Cta_Ing_Egr,
								null AS Fecha,
								0 AS Valor,
								' se encuentra asociado a un movimiento de banco anulado. *NC' AS motivo

            
			FROM saCobroTPReng RP 
			inner join saCobro E on E.cob_num = RP.cob_num
				INNER JOIN saMovimientoBanco MV ON MV.mov_num = RP.mov_num_b
            WHERE
                RP.forma_pag in ('TP','DP')
				AND MV.anulado = 1
				and E.anulado = 0
		UNION

		SELECT
                MV.rowguid AS IdM, RP.cob_num, RP.reng_num, MV.conciliado,
						CASE WHEN MV.numcom <> 0 AND MV.feccom > '01-01-1900' 
                                THEN
                                1
                                ELSE
								0
                                END
                                AS contabilizado,
								null AS Tasa,
								null AS Cta_Ing_Egr,
								null AS Fecha,
								0 AS Valor,
								' se encuentra asociado a
```
