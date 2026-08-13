# SP: pValidarDepositosBancarios
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pValidarDepositosBancarios
DESCRIPCION	: Valida las diferencias entre impuesto y comisión con sus respectivos porcentajes
DATE CREATE : <2019-09-30>
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarDepositosBancarios] 
	( 
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS 
BEGIN

	DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256) )
	DECLARE @uidID UNIQUEIDENTIFIER
	DECLARE @sDep_Num CHAR(20)
	DECLARE @sMov_Afec CHAR(20)
	DECLARE @sMov_Banco CHAR(20)
	DECLARE @iReng_Num INT
	DECLARE @dMonto DECIMAL(18, 5)
	DECLARE @dComision DECIMAL(18, 2)
	DECLARE @dImpuesto DECIMAL(18, 2)
	DECLARE @dPorc_Comision DECIMAL(18, 5)
	DECLARE @dPorc_Impuesto DECIMAL(18, 5)
	DECLARE @dTmp_Calc DECIMAL(18, 5)
	DECLARE @dImpuestoTasa DECIMAL(18, 5)
	DECLARE @dFecha_Mod DATETIME
	DECLARE @HoraCorrida DATETIME
	DECLARE @Motivo VARCHAR(256)
	DECLARE @bHuboCambio BIT
	DECLARE @bConciliado BIT
	DECLARE @bContabilizado BIT
	
	-- Primero, reconstruye los montos de Impuesto y Comisión en los casos en los que haya porcentajes correspondientes registrados
	DECLARE RECONS_VALIDAR CURSOR LOCAL FAST_FORWARD
	FOR
		SELECT A.dep_num, A.reng_num, A.mov_afec_c, A.monto, A.comision, A.impuesto, A.porc_comision, A.porc_impuesto, A.rowguid, B.mov_num_b
			FROM saDepositoBancoReng A
			INNER JOIN saDepositoBanco B ON B.dep_num = A.dep_num
			WHERE ((A.porc_impuesto <> 0) OR (A.porc_comision <> 0))
			
	OPEN RECONS_VALIDAR
	FETCH NEXT FROM RECONS_VALIDAR INTO @sDep_Num, @iReng_Num, @sMov_Afec, @dMonto, @dComision, @dImpuesto, @dPorc_Comision, @dPorc_Impuesto, @uidID, @sMov_Banco
	WHILE @@FETCH_STATUS = 0
	BEGIN
		IF @sMov_Banco IS NULL
			SELECT @bConciliado = 0, @bContabilizado = 0
		ELSE
			SELECT @bConciliado = conciliado, @bContabilizado = CASE WHEN (numcom <> 0) AND (feccom > '01-01-1900') THEN 1 ELSE 0 END
				FROM saMovimientoBanco WHERE mov_num = @sMov_Banco
		
		IF @bConciliado = 0 AND @bContabilizado = 0
		BEGIN
			SET @bHuboCambio = 0
			
			--Valida que la comisión coincida con los cálculos
			SET @dTmp_Calc = ROUND(((@dMonto * @dPorc_Comision)/100), 2)
			IF @dTmp_Calc <> @dComision
			BEGIN
				SET @Motivo = 'El depós
```
