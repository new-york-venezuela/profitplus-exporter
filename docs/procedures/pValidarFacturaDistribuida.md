# SP: pValidarFacturaDistribuida
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarFacturaDistribuida
DESCRIPCION:	Procedimiento que valida si una factura ha sido distribuida
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarFacturaDistribuida]
    @sDoc_num CHAR(20) , 
	@sCo_tipo_doc CHAR(6)
AS 
    BEGIN
		
		DECLARE @bExiste BIT
		SET @bExiste = 0
		IF @sCo_tipo_doc = 'FACT' -- Busca en saFacturaCompra
			IF (SELECT TOP(1)
					COALESCE(saDistribCostoOrigenReng.rowguid, saDistribCostoDestinoReng.rowguid) AS rowguid
			FROM	saFacturaCompraReng 
					LEFT JOIN saDistribCostoOrigenReng ON saFacturaCompraReng.Rowguid = saDistribCostoOrigenReng.rowguid_comp
					LEFT JOIN saDistribCosto DCO ON DCO.distrib_num = saDistribCostoOrigenReng.distrib_num
					LEFT JOIN saDistribCostoDestinoReng ON saFacturaCompraReng.Rowguid = saDistribCostoDestinoReng.rowguid_comp
					LEFT JOIN saDistribCosto DCD ON DCD.distrib_num = saDistribCostoDestinoReng.distrib_num
			WHERE
					saFacturaCompraReng.doc_num = @sDoc_num AND (DCO.procesado = 1 or DCD.procesado = 1)) is not NULL
						BEGIN 
							SET @bExiste = 1
						END
		IF @sCo_tipo_doc = 'PLAN'  -- Busca en saPlantillaCompra
			IF ( SELECT  TOP(1)
					saDistribCostoOrigenReng.Rowguid
			FROM	saPlantillaCompraReng 
					LEFT JOIN saDistribCostoOrigenReng ON saPlantillaCompraReng.Rowguid = saDistribCostoOrigenReng.rowguid_pcom 
					LEFT JOIN saDistribCosto ON saDistribCosto.distrib_num = saDistribCostoOrigenReng.distrib_num
			WHERE
					saPlantillaCompraReng.doc_num = @sDoc_num AND saDistribCosto.procesado = 1) is not NULL
						BEGIN 
							SET @bExiste = 1
						END
        SELECT @bExiste

    END
```
