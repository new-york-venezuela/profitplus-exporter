# SP: pValidarMontosDepositosBancarios
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pValidarMontosDepositosBancarios
DESCRIPCION	: Verificar diferencias entre el monto del depósito y el monto del movimiento
CREADO POR	: SOFTECH SISTEMAS
FECHA CREACIÓN: <2019-09-30>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarMontosDepositosBancarios] 
	( 
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS 
BEGIN

	DECLARE @tResultados TABLE ( motivo VARCHAR(256) )
	DECLARE @Motivo AS VARCHAR(256)
	DECLARE @cDep_Num AS char(20)
	DECLARE @cMov_Num AS char(20)
	DECLARE @iReng_Num AS INT
	DECLARE @dMontoDep AS DECIMAL(18, 2)
	DECLARE @dMontoBanco AS DECIMAL(18, 2)
	DECLARE @dMontoCaja AS DECIMAL(18, 2)
	DECLARE @bConciliado AS BIT
	DECLARE @bContabilizado AS BIT
	DECLARE @uRowguid AS UNIQUEIDENTIFIER
	DECLARE @HoraCorrida DATETIME
	
-- Caso 2: Verificar diferencias entre el monto del depósito y el monto del movimiento de banco.

	DECLARE BANCO_CURSOR CURSOR LOCAL FAST_FORWARD FOR	
		SELECT dep_num, mov_num_b AS mov_num, monto_h AS monto_banco, monto_dep, conciliado, contabilizado FROM
			(SELECT A.dep_num, A.mov_num_b, B.monto_d, B.monto_h, monto_dep = A.total_efec + C.sMonto - C.sImpuesto - C.sComision,
				B.conciliado, CASE WHEN (B.numcom <> 0) AND (B.feccom > '01-01-1900') THEN 1 ELSE 0 END AS contabilizado
				FROM saDepositoBanco A INNER JOIN saMovimientoBanco B ON A.mov_num_b = B.mov_num
				INNER JOIN (SELECT SUM(monto) AS sMonto, SUM(impuesto) AS sImpuesto,
					SUM(comision) AS sComision, dep_num FROM saDepositoBancoReng GROUP BY dep_num) C ON A.dep_num = C.dep_num) D
		WHERE monto_h <> monto_dep
	
	OPEN BANCO_CURSOR
	FETCH NEXT FROM BANCO_CURSOR INTO @cDep_Num, @cMov_Num, @dMontoBanco, @dMontoDep, @bConciliado, @bContabilizado
	WHILE @@FETCH_STATUS = 0
	BEGIN
		IF @cMov_Num IS NULL
			SELECT @bConciliado = 0, @bContabilizado = 0
		
		IF (@bConciliado = 0) AND (@bContabilizado = 0)
		BEGIN
			SET @Motivo = 'El monto del movimiento de banco "' + RTRIM(@cMov_Num) +  '" no coincide con el del depósito "' + RTRIM(@cDep_Num) +  '".'
			
			IF (@bCorregir = 1)
			BEGIN
				SELECT @uRowguid = rowguid FROM saMovimientoBanco WHERE mov_num = @cMov_Num
				UPDATE saMovimientoBanco SET monto_h = @dMontoDep WHERE mov_num = @cMov
```
