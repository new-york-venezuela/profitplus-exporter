# SP: pSeleccionarRenglonesRetenIvaPago
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRetenIvaReng`](../tables/saPagoRetenIvaReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesRetenIvaPago]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER, 
	  @gRowguid_Reng_Ori UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
	
	IF @gRowguid_Reng_Ori IS NULL OR LTRIM(RTRIM(@gRowguid_Reng_Ori)) = '' --Vas con el Padre 
	BEGIN
    
        SELECT
            DC.nro_doc, DC.co_tipo_doc, dc.num_comprobante, PRIR.*, 
            CASE PRIR.reten_tercero WHEN 1 THEN (SELECT IvaTercero.co_prov FROM [dbo].[ObtenerRetencionTercerosIva](PDR.reten_tercero_rowguid_ori, PDR1.nro_doc, PDR1.co_tipo_doc) AS IvaTercero)
                                           ELSE DC.Co_Prov
            END Co_Prov,
			/*INICIO PORCENTAJE DE RETENCIÓN*/
            CASE PRIR.reten_tercero WHEN 1 THEN (SELECT IvaTercero.porc_retenv  FROM [dbo].[ObtenerRetencionTercerosIva](PDR.reten_tercero_rowguid_ori, PDR1.nro_doc, PDR1.co_tipo_doc) AS IvaTercero)
										   ELSE (SELECT prov.porc_esp from saProveedor prov WHERE prov.co_prov = DC.co_prov) 
			END AS porc_reten, 
			/*FIN PORCENTAJE DE RETENCIÓN*/
            DC.nro_doc AS numero_fact,
            CASE PRIR.reten_tercero WHEN 1 THEN (SELECT IvaTercero.monto_imp FROM [dbo].[ObtenerRetencionTercerosIva](PDR.reten_tercero_rowguid_ori, PDR1.nro_doc, PDR1.co_tipo_doc) AS IvaTercero)
										   ELSE (SELECT SUM(FCR.monto_imp) FROM saFacturaCompraReng  FCR INNER JOIN saArticulo ART ON ART.co_art = FCR.co_art AND ART.reten_iva_tercero IS NULL AND ART.tipo_imp != 7 WHERE FCR.doc_num = PDR1.nro_doc)
			END AS monto_imp,
			/*CÓDIGO DEL ARTICULO RETEN_IVA*/
            CASE PRIR.reten_tercero WHEN 1 THEN (SELECT  IvaTercero.co_art FROM [dbo].[ObtenerRetencionTercerosIva](PDR.reten_tercero_rowguid_ori, PDR1.nro_doc, PDR1.co_tipo_doc) AS IvaTercero)
                                           ELSE NULL
            END Co_Art,
			CASE PRIR.reten_tercero WHEN 1 THEN (SELECT  IvaTercero.art_des FROM [dbo].[ObtenerRetencionTercerosIva](PDR.reten_tercero_rowguid_ori, PDR1.nro_doc, PDR1.co_tipo_doc) AS IvaTercero)
                                           ELSE NULL
                                    END Art_Des, DC.tipo_imp
        FROM
            saPagoRetenIvaReng AS PRIR
            INNER JOIN saPagoDocReng AS PDR ON PRIR.Rowguid_Reng_Cob = PDR.rowguid
            INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
            INNER JOIN saDocumentoCompra AS DC ON PDR.nro_doc = DC.nro_doc
                                                  AND
```
