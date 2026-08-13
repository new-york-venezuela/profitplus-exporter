# SP: pValidarCobrosFormaCobroTransferencia
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-08-2015>
-- LastUpdate:	<2020-08-03>
-- Description:	pValidarCobrosFormaCobroTransferencia
-- =============================================
CREATE PROCEDURE [dbo].[pValidarCobrosFormaCobroTransferencia]
	(
		@bCorregir BIT = 0, --INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN

		DECLARE @valPendienteResult TABLE ( Motivo VARCHAR(256) )
		DECLARE @pMotivo VARCHAR(256)
		DECLARE @pIdCP UNIQUEIDENTIFIER
		DECLARE @pReng_Num INT
        DECLARE @pCob_Num CHAR(20)
		DECLARE @pCuenta CHAR(6)
		DECLARE @pMonto DECIMAL(18,2)
		DECLARE @pNum_Doc CHAR(60)
		DECLARE @dFechaCobro SMALLDATETIME
		DECLARE @pCta_ingr_egr CHAR(20)
		DECLARE @pTasa DECIMAL(21,8)
		DECLARE @pCo_sucu CHAR(6)
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME

		--NÚMERO CONSECUTIVO PARA MOV. BANCO
		DECLARE @strCo_generacion CHAR(20)
		DECLARE @UsoSucursal BIT

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
				FOR
					
					SELECT
					
						'El Cobro nro. "' + RTRIM(CP.cob_num) + '" renglón "' + CONVERT(VARCHAR, CP.reng_num) + '" no posee un movimiento de banco asociado.' AS motivo,
						CP.rowguid, CP.reng_num, CP.cob_num, CP.cod_cta, CP.mont_doc, CP.num_doc, CP.fecha_che, CO.tasa, CL.co_cta_ingr_egr, CP.co_sucu_in

					FROM

						saCobroTPReng CP
						INNER JOIN saCobro CO ON CP.cob_num = CO.cob_num
						INNER JOIN saCliente CL ON CO.co_cli = CL.co_cli
	
	
					WHERE

						(CP.forma_pag = 'TP')
						AND (
							CP.mov_num_b NOT IN (SELECT MV.mov_num FROM saMovimientoBanco MV)
							OR (CP.mov_num_b IS NULL)
							)
							

			OPEN PENDIENTE_VALIDAR
			FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pMotivo, @pIdCP, @pReng_Num, @pCob_Num, @pCuenta, @pMonto, @pNum_Doc,
													@dFechaCobro, @pTasa, @pCta_ingr_egr, @pCo_sucu

			WHILE @@FETCH_STATUS = 0 
			BEGIN
				   SET @PistaMensaje = @pMotivo

				   IF ( @bCorregir = 1) 
				   BEGIN  
					 
						DECLARE @Descrip_movBan VARCHAR(60)
						SET @Descrip_movBan = 'Cobro ' + RTRIM(@pCob_Num)
						DECLARE @TabUsoSucuComi Table
						(
							UsoSucursal BIT,
							maneja_sucursal BIT
						)
						INSERT INTO @TabUsoSucuComi	EXEC pSeleccionarUsoSucursalConsecutivoTipo @sCo_Consecutivo=N'MOVB_NUM'
						SET @UsoSucursal = (SELECT TOP(1) UsoSucursal FROM @TabUsoSucuComi)
						IF @Us
```
