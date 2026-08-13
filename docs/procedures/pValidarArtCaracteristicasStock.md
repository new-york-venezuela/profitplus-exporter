# SP: pValidarArtCaracteristicasStock
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarArtCaracteristicasStock]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN


DECLARE @ValResult TABLE ( Motivo VARCHAR(256) )

DECLARE VALIDAR_CARACTERISTICA CURSOR LOCAL FAST_FORWARD
FOR 
		-- AJUSTE
		select 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) as total_art,
		abs(sum(CA.cantidad)) as total_art_carac
		from [dbo].[savArtCaracteristicaAJUS] CA
		inner join [dbo].[saAjusteReng] DOC ON CA.Num_doc = ajue_num and CA.reng_num = DOC.reng_num
		Group by 
		CA.tipo_doc, CA.co_Art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) 
		Having 
		ABS(SUM(CA.cantidad)) > [dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art)
		-- TRASLADO
		Union
		select 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) as total_art,
		abs(sum(CA.cantidad)) as total_art_carac
		from [dbo].[savArtCaracteristicaTRAS] CA
		inner join [dbo].[saTrasladoReng] DOC ON CA.Num_doc = tras_num and CA.reng_num = DOC.reng_num
		Group by 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) 
		Having 
		ABS(SUM(CA.cantidad)) > [dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art)
		-- Nota Recepcion
		Union
		select 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) as total_art,
		abs(sum(CA.cantidad)) as total_art_carac
		from [dbo].[savArtCaracteristicaNREC] CA
		inner join [dbo].[saNotaRecepcionCompraReng] DOC ON CA.Num_doc = doc_num and CA.reng_num = DOC.reng_num
		Group by 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) 
		Having 
		ABS(SUM(CA.cantidad)) > [dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art)
		-- Factura de Compra
		Union
		select 
		CA.tipo_doc, CA.co_art, CA.Num_doc, CA.reng_num, CA.co_uni,
		[dbo].[ArtUnidadBase](DOC.co_art, DOC.co_uni, DOC.total_Art) as total_art,
		abs(sum(CA.cantidad)) as total_art_carac
		from [dbo].[savArtCaracteristicaCOMP] CA
		inner join [dbo].[saFacturaCompraReng] DOC ON CA.Num_doc = doc_num and CA.reng_num = DOC.reng_num
		Group by 
		CA.ti
```
