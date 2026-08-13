# SP: pValidarRequisicionCompraEstatus
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarRequisicionCompraEstatus]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @sDoc_Num CHAR(20)
		DECLARE @cResultado_Esperado int
		DECLARE @cEstatus int
		DECLARE @PistaMensaje AS VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME
		DECLARE @uRowguid UNIQUEIDENTIFIER

	-- Se compara el estatus de la requisición con el estatus de sus renglones
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
			SELECT doc_num, resultado_esperado, estatus, rowguid
			FROM (
				 SELECT saPlantillaCompra.doc_num, ROUND(SUM(CAST(saPlantillaCompraReqRenglon.estatus AS int)) / COUNT(saPlantillaCompraReqRenglon.estatus),0) as resultado_esperado,
						saPlantillaCompraReq.estatus, saPlantillaCompraReq.rowguid
		
				 FROM   dbo.saPlantillaCompra																											 INNER JOIN
						dbo.saPlantillaCompraReq        ON dbo.saPlantillaCompra.rowguid     = saPlantillaCompraReq.rowguid_plantilla_compra             INNER JOIN
						dbo.saPlantillaCompraReng       ON dbo.saPlantillaCompra.doc_num     = dbo.saPlantillaCompraReng.doc_num                         INNER JOIN
						dbo.saPlantillaCompraReqRenglon ON dbo.saPlantillaCompraReng.rowguid = dbo.saPlantillaCompraReqRenglon.rowguid_plantilla_renglon
				 GROUP BY saPlantillaCompra.doc_num, saPlantillaCompraReq.estatus, saPlantillaCompraReq.rowguid
					) AS Sub
			WHERE resultado_esperado <> estatus


        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @sdoc_num, @cResultado_Esperado, @cEstatus, @uRowguid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'La requisición nro. "' + RTRIM(@sDoc_Num)
                    + '" tiene el estatus: "' + CASE @cEstatus WHEN 0 THEN 'sin procesar' WHEN 1 THEN 'parcialmente procesado' WHEN 2 THEN 'procesado' END
					+ '" según el estatus de sus renglones debe ser: "' + CASE @cResultado_Esperado WHEN 0 THEN 'sin procesar' WHEN 1 THEN 'parcialmente procesado' WHEN 2 THEN 'procesado' END + '"'


				IF @bCorregir = 1
					BEGIN
							UPDATE saPlantillaCompraReq SET estatus = @cResultado_Esperado WHERE rowguid = @uRowguid

							SET @HoraCorrida = GETDATE()
							EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
								@s
```
