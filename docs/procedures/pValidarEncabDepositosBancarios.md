# SP: pValidarEncabDepositosBancarios
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
NOMBRE		: pValidarEncabDepositosBancarios
DESCRIPCION	: Verificar la existencia de renglones para un depósito y de un depósito para los renglones
CREADO POR	: SOFTECH SISTEMAS
FECHA CREACIÓN: <2019-09-30>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarEncabDepositosBancarios] 
	( 
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS 
BEGIN

	DECLARE @tResultados TABLE ( motivo VARCHAR(256) )
	DECLARE @Motivo AS VARCHAR(256)
	DECLARE @cDep_Num AS char(20)
	DECLARE	@iReng_Num AS int
	DECLARE @cMov_Afec_C AS char(20)
	DECLARE @cMov_Num_B AS char(20)
	DECLARE @uRowguid AS UNIQUEIDENTIFIER
	DECLARE @uDelRowguid AS UNIQUEIDENTIFIER
	DECLARE @HoraCorrida DATETIME
	DECLARE @bConciliado AS BIT
	DECLARE @bContabilizado AS BIT
	
-- Caso 1: Verificar la existencia de renglones para un depósito.

	DECLARE ENCABEZADO_CURSOR CURSOR LOCAL FAST_FORWARD FOR	
		SELECT A.dep_num, A.mov_num_b, A.rowguid FROM saDepositoBanco A WHERE NOT EXISTS 
			(SELECT * FROM saDepositoBancoReng B WHERE B.dep_num = A.dep_num) AND A.total_efec = 0
		
	OPEN ENCABEZADO_CURSOR
	FETCH NEXT FROM ENCABEZADO_CURSOR INTO @cDep_Num, @cMov_Num_B, @uRowguid
	WHILE @@FETCH_STATUS = 0
	BEGIN
		IF @cMov_Num_B IS NULL
			SELECT @bConciliado = 0, @bContabilizado = 0
		ELSE
			SELECT @bConciliado = conciliado, @bContabilizado = CASE WHEN (numcom <> 0) AND (feccom > '01-01-1900') THEN 1 ELSE 0 END
			FROM saMovimientoBanco WHERE mov_num = @cMov_Num_B
				
		SET @Motivo = 'El depósito "' + RTRIM(@cDep_Num) +  '" no tiene renglones.'
		
		IF (@bConciliado = 0) AND (@bContabilizado = 0)
		BEGIN
			IF (@bCorregir = 1)
			BEGIN
				DELETE FROM saDepositoBanco WHERE dep_num = @cDep_Num
			
				SET @HoraCorrida = GETDATE()
				EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
					@sTablaOri = 'saDepositoBanco', @rowguidOri = @uRowguid, @sTipo_Op = N'E', @sMaquina = NULL,
					@sCampos = @Motivo
				
				SELECT @uDelRowguid = rowguid FROM saMovimientoBanco WHERE mov_num = @cMov_Num_B
				DELETE FROM saMovimientoBanco WHERE mov_num = @cMov_Num_B
				
				EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
					@sTabla
```
