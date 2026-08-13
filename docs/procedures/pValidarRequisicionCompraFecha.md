# SP: pValidarRequisicionCompraFecha
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <14-04-2016>
-- Description:	<pValidarRequisicionCompraFecha>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarRequisicionCompraFecha]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @Valor INT
		DECLARE @Id1 UNIQUEIDENTIFIER		
		DECLARE @Tabla VARCHAR(32)		
		DECLARE @Id2 UNIQUEIDENTIFIER


		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR		
			/*
			5ta parte
			*/
			--Si se encuentra entregado el renglon de lo requisición, la fecha real de entrega no puede ser distinta a la fecha requisición
			SELECT DISTINCT
				'El renglón nro. ' + RTRIM(PCR.reng_num)  + ' de la requisición nro. "' +  RTRIM(PC.doc_num) +
				'" posee fecha ' + ISNULL(CONVERT(VARCHAR(10),(PCRRE.fecha_real_entrega),105),'') + ' y tiene que ser ' + 
				ISNULL(CONVERT(VARCHAR(10),(PCREQ.fecha),105),'') AS motivo, 1 AS valor, PCRRE.rowguid AS Id1, 
				'saPlantillaCompraReqRelacion' AS tabla, PCREQ.rowguid AS Id2
			FROM
				saPlantillaCompraReqRenglon  PCRR
				RIGHT JOIN saPlantillaCompraReng PCR ON PCRR.rowguid_plantilla_renglon = PCR.rowguid
				INNER JOIN saPlantillaCompra PC ON PC.doc_num = PCR.doc_num
				LEFT JOIN saPlantillaCompraReq PCREQ ON PC.rowguid = PCREQ.rowguid_plantilla_compra
				LEFT JOIN saPlantillaCompraReqRelacion PCRRE ON PCRR.rowguid = PCRRE.rowguid_reng_req			
			
			WHERE            		
				PCREQ.rowguid IS NOT NULL AND PCRRE.fecha_real_entrega <> PCREQ.fecha

		OPEN PENDIENTE_VALIDAR
		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Valor, @Id1, @Tabla, @Id2
		WHILE @@FETCH_STATUS = 0
		
			BEGIN
				IF @Valor = 1
					BEGIN
						SET @PistaMensaje = @Motivo
						IF @bCorregir = 1
							BEGIN
								UPDATE saPlantillaCompraReqRelacion
								SET fecha_real_entrega = (Select TOP(1) fecha From saPlantillaCompraReq Where rowguid = @Id2)
								WHERE rowguid = @Id1
							END
					END
					
					EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                    @sTablaOri = @Tabla, @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = N
```
