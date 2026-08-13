# SP: pObtenerUltimoCostoPorProveedor
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)

## Código (excerpt)
```sql
-- ================================================
-- Author:		<Softech Consultores C.A.>
-- Create date: <29-07-2016>
-- Description:	<Obtiene el costo más reciente
--				para un artículo dado un proveedor>
-- ================================================
CREATE PROCEDURE [dbo].[pObtenerUltimoCostoPorProveedor] 
(
	-- Add the parameters for the function here
	@sCo_Art CHAR(30) ,
	@sCo_Prov CHAR(16) = NULL ,
	@dtFecha DATETIME
	
)

AS
BEGIN

	-- Add the T-SQL statements to compute the return value here

	SELECT TOP(1) ISNULL(e.costo, 0.00000) as costo

	FROM saCostoHistoricoEntrada AS e
	LEFT JOIN saFacturaCompraReng AS fr ON e.doc_orig = fr.rowguid AND e.tipo_doc = 'COMP' AND e.costo > 0.00000
	LEFT JOIN saFacturaCompra AS f ON fr.doc_num = f.doc_num
	LEFT JOIN saNotaRecepcionCompraReng rr ON e.doc_orig = rr.rowguid AND e.tipo_doc = 'NREC' AND e.costo > 0.00000
	LEFT JOIN saNotaRecepcionCompra r ON rr.doc_num = r.doc_num

	WHERE
	((f.co_prov = @sCo_Prov OR r.co_prov = @sCo_Prov)
	OR
	(@sCo_prov IS NULL))

	AND 
	(fr.co_art = @sCo_Art OR rr.co_art = @sCo_Art)
	AND
	(e.fecha_emision <= @dtFecha)

	ORDER BY e.fecha_emision DESC
	
END
```
