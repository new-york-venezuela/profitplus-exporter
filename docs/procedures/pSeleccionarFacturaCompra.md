# SP: pSeleccionarFacturaCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			: pSeleccionarCompra
DESCRIPCION		: Selecciona un registro de la tabla saFacturaCompra segun su primary key
CREADO POR		: SOFTECH SISTEMAS
FECHA ACTUALIZACIÓN: 2019-04-29
MODIFCADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarFacturaCompra] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            fc.*, ISNULL(cp.dias_cred, 0) AS dias_cred, CAST(ISNULL(dc.pagar, 0) AS BIT) AS autorizado,
			CASE WHEN EXISTS(SELECT DI.fact_num
                    FROM
                        saDatosDeImportacion DI
                        INNER JOIN saFacturaCompra AS FCI ON FCI.doc_num = DI.fact_num
                    WHERE
                        DI.fact_num = @sDoc_Num) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS EsFacturaImportacion,
						NCF.ncf as NumeroControlFiscal, NCF.co_anulacion AS co_anulacion, NCF.co_serie AS co_serie, 
						ST.des_tipo_serie AS des_tipo_serie, NCF.tipo_doc_Ori AS tipo_doc_ori, NCF.nro_doc_Ori AS nro_doc_Ori,
						NCF.co_gasto AS co_gasto
        FROM
            saFacturaCompra fc
            LEFT JOIN saCondicionPago cp ON fc.co_cond = cp.co_cond
			LEFT JOIN saDocumentoCompra dc ON dc.co_tipo_doc = 'FACT' AND dc.nro_doc = fc.doc_num
			LEFT JOIN saNCFInfoDocCompra NCF ON NCF.nro_doc = dc.nro_doc AND NCF.tipo_doc = dc.co_tipo_doc
			LEFT JOIN saSerie SE ON NCF.co_serie = SE.co_serie
			LEFT JOIN saSerieTipo ST ON SE.co_tipo_serie = ST.co_tipo_serie
        WHERE
            doc_num = @sDoc_Num

    END
```
