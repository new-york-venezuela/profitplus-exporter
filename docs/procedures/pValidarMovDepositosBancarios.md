# SP: pValidarMovDepositosBancarios
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pValidarMovDepositosBancarios
DESCRIPCION	: Verifica los montos y coherencia de los movimientos de cajas
CREADO POR	: SOFTECH SISTEMAS
FECHA CREACIÓN: <2019-11-21>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarMovDepositosBancarios] 
	( 
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS 
BEGIN

	DECLARE @tResultados TABLE ( motivo VARCHAR(256) )
	DECLARE @Motivo AS VARCHAR(256)
	DECLARE @cDep_Num AS char(20)
	DECLARE @cMov_Afec AS char(20)
	DECLARE @cMov_Gene AS char(20)
	DECLARE @dMontoAfec AS DECIMAL(18, 2)
	DECLARE @dMontoGene AS DECIMAL(18, 2)
	DECLARE @uRowguid AS UNIQUEIDENTIFIER
	DECLARE @HoraCorrida DATETIME
	
-- Caso 4: Verificar que los montos de los movimientos de cajas sean iguales.

	DECLARE CAJA_CURSOR CURSOR LOCAL FAST_FORWARD FOR	
		SELECT A.dep_num, A.mov_afec_c, A.mov_gene_c, B.monto_afectado, C.monto_generado FROM saDepositoBancoReng A
			INNER JOIN (SELECT monto_h AS monto_afectado, mov_num FROM saMovimientoCaja) B ON A.mov_afec_c = B.mov_num
			INNER JOIN (SELECT monto_d AS monto_generado, mov_num FROM saMovimientoCaja) C ON A.mov_gene_c = C.mov_num
			WHERE (A.mov_afec_c IS NOT NULL) AND (A.mov_gene_c IS NOT NULL)
			AND B.monto_afectado <> C.monto_generado
	
	OPEN CAJA_CURSOR
	FETCH NEXT FROM CAJA_CURSOR INTO @cDep_Num, @cMov_Afec, @cMov_Gene, @dMontoAfec, @dMontoGene
	WHILE @@FETCH_STATUS = 0
	BEGIN
		SET @Motivo = 'El monto del movimiento Afectado "' + RTRIM(@cMov_Afec) +  '" no coincide con el del movimiento Generado "' + RTRIM(@cMov_Gene) +  '".'
		
		IF (@bCorregir = 1)
		BEGIN
			SELECT @uRowguid = rowguid FROM saMovimientoCaja WHERE mov_num = @cMov_Gene
			UPDATE saMovimientoCaja SET monto_d = @dMontoAfec WHERE mov_num = @cMov_Gene
			
			SET @HoraCorrida = GETDATE()
			EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
				@sTablaOri = 'saMovimientoBanco', @rowguidOri = @uRowguid, @sTipo_Op = N'M', @sMaquina = NULL,
				@sCampos = @Motivo
				
			SET @Motivo = @Motivo + ' Corregido. El monto del movimiento de caja Generado era ' + CONVERT(NVARCHAR(MAX), @dMontoAfec) + 
					'; el nuevo valos es ' + CONVERT(NVARCHAR(MAX), @dMontoGene)--REVISAR CON LISANDRO A
```
