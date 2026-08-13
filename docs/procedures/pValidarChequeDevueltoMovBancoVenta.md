# SP: pValidarChequeDevueltoMovBancoVenta
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08-06-2015>
-- Description:	<pValidarChequeDevueltoMovBanco>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarChequeDevueltoMovBancoVenta]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
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
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				 		
		
		/*
		5ta parte
		*/
		--Valida que el moviento de banco tenga asociado un documento de venta de tipo (CHEQ)
			SELECT DISTINCT
				'El movimiento de banco "' +  RTRIM(MB.mov_num) +  '" no posee documento de venta asociado' 
				as motivo, MB.rowguid as ID1, MB.rowguid as ID2, NULL as ValCli, 0 as MontBru, 0 as IVA,
				0 as MontNeto, 0 as tasa, 1 as valor, NULL as Caract20
			FROM
				saMovimientoBanco MB
				LEFT JOIN saDocumentoVenta DV ON DV.mov_ban = MB.mov_num
			WHERE 
				MB.mov_num NOT IN (Select mov_ban from saDocumentoVenta where mov_ban IS NOT NULL) AND origen ='CHD' AND cob_pag IS NOT NULL AND tipo_op = 'ND'


		OPEN PENDIENTE_VALIDAR
		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id1, @Id2, @ValCli, @MontBru, @IVA, @MontNeto, @Porc_Tasa, @Valor, @Caract20

		WHILE @@FETCH_STATUS = 0
		
			BEGIN
				 IF @Valor = 1
					BEGIN
						SET @PistaMensaje = @Motivo
						IF @bCorregir = 1
							BEGIN
								UPDATE 
									saMovimientoBanco
								SET 
									cob_pag = NULL,
									origen = 'BAN'
								WHERE rowguid = @Id2
								SET @HoraCorrida = GETDATE()
								EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
									  @sTablaOri = 'saMovimientoBanco', @rowguidOri = @Id2, @sTipo_Op = N'E', @sMaquina = NULL,
									  @sCampos = @PistaMensaje
							END
					END				
					


					INSERT INTO @valPendienteResult (motivo)
					VALUES (@PistaMensaje)
					FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @
```
