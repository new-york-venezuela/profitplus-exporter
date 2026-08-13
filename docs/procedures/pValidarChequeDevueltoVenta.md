# SP: pValidarChequeDevueltoVenta
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18-06-2015>
-- Description:	<pValidarChequeDevueltoVenta>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarChequeDevueltoVenta]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( Motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @Id1 UNIQUEIDENTIFIER
		DECLARE @Id2 UNIQUEIDENTIFIER
		DECLARE @ValCli CHAR(20)
		DECLARE @MontBru DECIMAL(18,2)
		DECLARE @IVA DECIMAL(18,2)
		DECLARE @MontNeto DECIMAL(18,2)
		DECLARE @Porc_Tasa DECIMAL(18,2)
		DECLARE @Valor INT
		DECLARE @Caract20 CHAR(20)
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		DECLARE @dFecha SMALLDATETIME
		
		SET @HoraCorrida = GETDATE()
		SET @dFecha = (SELECT 
				TOP(1) CDV.fecha
			FROM					
				saCobro COB 
				INNER JOIN saCobroTPReng COBR ON COBR.cob_num = COB.cob_num AND COBR.forma_pag = 'CH'
				RIGHT JOIN saChequeDevueltoVenta CDV  ON CDV.num_doc = COBR.num_doc AND CDV.co_ban = COBR.co_ban
				INNER JOIN saDocumentoVenta DV ON DV.nro_doc = CDV.nro_doc AND CDV.co_tipo_doc = 'CHEQ'
				INNER JOIN saMovimientoBanco MB ON MB.mov_num = DV.mov_ban		
			WHERE
				CDV.automatico = 1 AND CDV.procesado = 1 AND COB.anulado = 0 AND (COBR.mont_doc <> CDV.mont_doc OR COBR.mont_doc <> DV.total_neto))	
	
				Declare @tabTemp table
				(
					fecha SmallDateTime,
					tipo_imp int,
					porc_tasa Decimal,
					porc_suntuario Decimal
				)
			 insert INTO @tabTemp exec pObtenerFechaImpuestoSobreVenta @dtFecha = @dFecha,@bVentas=1 

			 DECLARE @tasa decimal
			 SET @tasa = (SELECT TOP(1) porc_tasa from @tabTemp)

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				 		

		/*
		1era parte
		*/
		--Valida si un cheque devuelto tiene un cobro asociado o se encuentra anulado
			SELECT DISTINCT
				CASE WHEN COB.cob_num IS NULL THEN
					'El cheque devuelto "' + RTRIM(CDV.co_cheq_dev) + '" no posee cobro asociado. *NC.' 
				WHEN COB.anulado = 1 THEN
					'El cheque devuelto "' + RTRIM(CDV.co_cheq_dev) + '" posee el cobro anulado. *NC.' END as motivo, NULL as ID1, 
					NULL as ID2, NULL as ValCli, 0 as MontBru, 0 as IVA, 0 as MontNeto, 0 as tasa, 0 as valor, NULL as Caract20
			FROM					
				saCobro COB 
				INNER JOIN saCobroTPReng COBR ON COBR.cob_num = COB.cob_num
```
