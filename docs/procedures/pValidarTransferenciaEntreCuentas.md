# SP: pValidarTransferenciaEntreCuentas
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-08-2015>
-- Last Update: 2020-08-03
-- Description:	<pValidarTransferenciaEntreCuentas>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarTransferenciaEntreCuentas]
	(
		@bCorregir BIT = 0, --INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( Motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @Id1 UNIQUEIDENTIFIER
		DECLARE @Referencia CHAR(60)
		DECLARE @Monto DECIMAL(18,2)
		DECLARE @Monto_saldo DECIMAL(18,2)
		DECLARE @Comision DECIMAL(18,2)
		DECLARE @Cuenta CHAR(6)
		DECLARE @Cta_ingr_egr CHAR(20)
		DECLARE @Mov_ban CHAR(20)
		DECLARE @Tasa DECIMAL(21,8)
		DECLARE @Co_sucu CHAR(6)
		DECLARE @dFecha SMALLDATETIME
		DECLARE @Co_trans_ban CHAR(20)
		DECLARE @Valor INT
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		DECLARE @Cod_emp CHAR(20)
		
		--Número consecutivo para movimiento banco
		DECLARE @strCo_generacion CHAR(20)
		DECLARE @UsoSucursal BIT

		SET @HoraCorrida = GETDATE()
		SET @Cod_emp = (SELECT TOP(1) cod_emp FROM par_emp)

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
		FOR			
			
		--Valida la transferencia entre cuentra este procesada, que exista el movimiento de banco y estos se encuentren conciliados y/o contabilizados
			SELECT  DISTINCT
				 'La transferecia entre cuenta "' + RTRIM(TEC.co_trans_ban) +
				 '" se encuentra procesado, no posee movimiento de banco y se encuentra ' + CASE WHEN (MB.conciliado = 1)
				 THEN 'conciliado' ELSE 'contablilizado' END + '. *NC.'
				  as motivo, NULL as ID1, NULL as Referencia, 0 as Monto, 0 as Monto_saldo, 0 as Comision, NULL as Cuenta, 
				  NULL as Cta_ingr_egr, NULL as Mov_ban, 0 as Tasa, NULL co_sucu, NULL as Fecha, NULL as Co_trans_ban, 0 as Valor
			FROM					
				saTransferenciaEntreCuentas TEC 
				LEFT JOIN saMovimientoBanco MB ON MB.mov_num = TEC.mov_ban_origen				
					
			WHERE
				TEC.procesado = 1 AND (MB.conciliado = 1 OR MB.numcom IS NOT NULL) AND
				((TEC.mov_ban_origen IS NULL OR 
				TEC.mov_ban_origen NOT IN (Select mov_num from saMovimientoBanco where mov_num IS NOT NULL)) AND
				(TEC.mov_ban_destino IS NULL OR 
				TEC.mov_ban_destino NOT IN (Select mov_num from saMovimientoBanco where mov_num IS NOT NULL)) AND
				(TEC.mov_ban_comision IS NULL OR 
				TEC.mov_b
```
