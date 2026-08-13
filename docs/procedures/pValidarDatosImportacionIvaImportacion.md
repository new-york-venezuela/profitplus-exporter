# SP: pValidarDatosImportacionIvaImportacion
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16-05-2016>
-- Description:	<pValidarDatosImportancionIvaImportacion>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarDatosImportacionIvaImportacion]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @PistaMensaje VARCHAR(MAX)		
		DECLARE @Id UNIQUEIDENTIFIER		

		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				
			--3era parte. Los artículos clasificados como Cálculo Impuesto al Valor Agregado deberán mantener el valor en cero(0) los campos costo y neto
			SELECT DISTINCT
				'La factura de compra nro. ' + RTRIM(FC.doc_num)  + ' posee el código articulo "' + RTRIM(FCR.co_art) + 
				'" con valor de ' + CASE WHEN FCR.reng_neto <> 0 THEN RTRIM(FCR.reng_neto) + ' en el campo neto' WHEN 
				FCR.cost_unit <> 0 THEN RTRIM(FCR.cost_unit) + ' en el campo costo' END AS motivo, FCR.rowguid as Id
			FROM
				saFacturaCompra FC
				INNER JOIN saFacturaCompraReng FCR ON FC.doc_num = FCR.doc_num
				INNER JOIN saArticulo ART ON FCR.co_art = ART.co_art
				RIGHT JOIN saArtImportacion ARTC ON ART.co_art = ARTC.co_art
				RIGHT JOIN saDatosDeImportacion DI ON FCR.rowguid = DI.rowguid_factura_renglon											
			WHERE            		
				(FCR.reng_neto <> 0 OR FCR.cost_unit <> 0) AND ARTC.calculo = 3

		OPEN PENDIENTE_VALIDAR		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id
		WHILE @@FETCH_STATUS = 0
		
			BEGIN				
				SET @PistaMensaje = @Motivo
				IF @bCorregir = 1
					BEGIN
						UPDATE saFacturaCompraReng
						SET reng_neto = 0, cost_unit = 0
						WHERE rowguid = @Id

						EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
						@sTablaOri = 'saFacturaCompraReng', @rowguidOri = @Id, @sTipo_Op = N'M', @sMaquina = NULL,
						@sCampos = @PistaMensaje
					END				
					
				EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                @sTablaOri = 'saFacturaCompraReng', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = NULL,
                @sCampos = @PistaMensaje										
					
				INSERT INTO @valPendienteResult (motivo)
				VALUE
```
