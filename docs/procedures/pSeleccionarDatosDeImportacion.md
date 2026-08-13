# SP: pSeleccionarDatosDeImportacion
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDatosDeImportacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDatosDeImportacion] ( @gRowguid_Factura_Renglon UNIQUEIDENTIFIER )
AS 
    BEGIN
        SELECT        
			FCR.reng_num, FCR.co_art, DI.fact_num, FCR.num_doc, FC.co_prov, DI.bl_awb_cpi, FC.total_bruto AS base_imp, DI.tasa, 
			DI.total_imp, DI.validador, DI.rowguid_factura_renglon
		FROM            
			saDatosDeImportacion DI
			RIGHT JOIN saFacturaCompraReng FCR ON DI.rowguid_factura_renglon = FCR.rowguid
			INNER JOIN saFacturaCompra FC ON FCR.doc_num = FC.doc_num
        WHERE
            DI.rowguid_factura_renglon = @gRowguid_Factura_Renglon
    END
```
