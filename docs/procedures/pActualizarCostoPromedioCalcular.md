# SP: pActualizarCostoPromedioCalcular
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarCostoPromedioCalcular]
    (
       @strNum_Doc CHAR(20), 
	   @strUsuario CHAR(6),
       @strMaquina CHAR(60),
	   @strTipoDoc CHAR(8),
	   @bTipo Bit ----- 1 Salida, 0 Entrada
    )
AS 
    BEGIN

        SET NOCOUNT ON

		DECLARE @stabla TABLE
		(
			--[reng_num] [int] NOT NULL,
			[doc_num] [char](20) NOT NULL,
			--[co_art] [char](30) NOT NULL,
			[rowguid] [uniqueidentifier] ROWGUIDCOL  NOT NULL ,
			[tipo_trans] [char](1) NOT NULL, -- 0 ENTRADA, 1 SALIDA
			[co_alma] [char](6) NOT NULL
		)

		IF (@strTipoDoc = 'COMP') --Factura de Compra
			INSERT INTO @stabla 
				SELECT doc_num, rowguid, @bTipo, co_alma from saFacturaCompraReng WHERE doc_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'FACT') --Factura de Venta
			INSERT INTO @stabla 
				SELECT doc_num, rowguid, @bTipo, co_alma from saFacturaVentaReng WHERE doc_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'AJUS') --Ajuste de entrada y salida
			INSERT INTO @stabla 
				SELECT saAjusteReng.ajue_num AS doc_num, saAjusteReng.rowguid, @bTipo, saAjusteReng.co_alma FROM saAjusteReng INNER JOIN saTipoAjuste ON saAjusteReng.co_tipo = saTipoAjuste.co_tipo WHERE saAjusteReng.ajue_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'GCOM') --Artículo Compuesto
			INSERT INTO @stabla 
				SELECT gene_num AS doc_num, rowguid, @bTipo,co_alma from saArtCompuestoGenReng WHERE gene_num = @strNum_Doc
				UNION
				SELECT gene_num AS doc_num, rowguid, @bTipo,co_alma from saArtCompuestoGen WHERE gene_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'TRAS') -- Traslados
			INSERT INTO @stabla 
				SELECT saTrasladoReng.tras_num AS doc_num, saTrasladoReng.rowguid, @bTipo, saTraslado.alm_dest FROM saTraslado INNER JOIN saTrasladoReng ON saTraslado.tras_num = saTrasladoReng.tras_num WHERE saTrasladoReng.tras_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'DCLI') --Devolución de cliente
			INSERT INTO @stabla 
				SELECT doc_num, rowguid, @bTipo, co_alma from saDevolucionClienteReng WHERE doc_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'DPRO') --Devolucion de proveedor
			INSERT INTO @stabla 
				SELECT doc_num, rowguid, @bTipo, co_alma from saDevolucionProveedorReng WHERE doc_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'NENT') --Nota de entrega
			INSERT INTO @stabla 
				SELECT doc_num, rowguid, @bTipo, co_alma from saNotaEntregaVentaReng WHERE doc_num = @strNum_Doc
		ELSE IF (@strTipoDoc = 'NREC') --Nota de Recepción
			INSERT INTO @stabla 
				SELECT doc_num,
```
