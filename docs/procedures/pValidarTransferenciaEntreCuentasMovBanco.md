# SP: pValidarTransferenciaEntreCuentasMovBanco
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-08-2015>
-- LastUpdate:  <2020-08-03>
-- Description:	<pValidarTransferenciaEntreCuentasMovBanco>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarTransferenciaEntreCuentasMovBanco]
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
			
		--Valida que el movimiento de banco tenga asciado una transferencia entre cuentra
			SELECT  DISTINCT
				 'El movimiento de banco "' + RTRIM(MB.mov_num) + '" no posee documento de venta asociado'as motivo, 
				  MB.rowguid as ID1, NULL as Referencia, 0 as Monto, 0 as Monto_saldo, 0 as Comision, NULL as Cuenta, 
				  NULL as Cta_ingr_egr, NULL as Mov_ban, 0 as Tasa, NULL as co_sucu, NULL as Fecha, NULL as Co_trans_ban, 1 as Valor
			FROM
				saMovimientoBanco MB
				--LEFT JOIN saTransferenciaEntreCuentas TEC ON MB.mov_num = TEC.mov_ban_destino				
			WHERE
				MB.mov_num NOT IN (SELECT mov_ban_origen from saTransferenciaEntreCuentas where mov_ban_origen IS NOT NULL) AND
				MB.mov_num NOT IN (SELECT mov_ban_comision from saTransferenciaEntreCuentas where mov_ban_comision IS NOT NULL) AND
				MB.mov_num NOT IN (SELECT mov_ban_destino from saTransferenciaEntreCuentas where mov_ban_destino IS NOT NULL) AND
				MB.descrip like 'Transferencia entre cuentas%' AND MB.cob_pag IS NOT NULL --AND MB.origen = 'BAN'
				


		OPEN PENDIENTE_VALIDAR


		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id1, @Referencia, @Monto, @Monto_saldo, @Comisi
```
