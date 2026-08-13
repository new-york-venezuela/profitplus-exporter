# SP: pSeleccionarFormasPagoDocumentoCompra_DOM
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSerie`](../tables/saSerie.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Last Modify: <21/05/2019>
-- Description:	<DGII Formato de Envío de Comprobantes Anulados (608)>
-- =============================================
--EXEC pSeleccionarFormasPagoDocumentoCompra_DOM '2019-01-01', '2019-05-31',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL
CREATE PROCEDURE [dbo].[pSeleccionarFormasPagoDocumentoCompra_DOM]
	  @dtDesde		SMALLDATETIME
	, @dtHasta		SMALLDATETIME
	, @nDocDesde	CHAR(20) = NULL
	, @nDocHasta	CHAR(20) = NULL
	, @nPagDesde	CHAR(20) = NULL
	, @nPagHasta	CHAR(20) = NULL
	, @ProveedorD	CHAR(10) = NULL
	, @ProveedorH	CHAR(10) = NULL
	, @TipoCompD	CHAR(2)  = NULL
	, @TipoCompH	CHAR(2)  = NULL
AS
       
  SELECT @dtHasta = DATEADD(MINUTE, -1, DATEADD(DAY, 1, @dtHasta))

    IF (@nDocDesde IS NULL OR @nDocHasta IS NULL)
                SELECT @nDocHasta = MAX(nro_doc) FROM saDocumentoCompra 

    IF (@nPagDesde IS NULL OR @nPagHasta IS NULL)
                SELECT @nPagHasta = MAX(cob_num) FROM saPago

 
 SELECT  D.fec_emis AS fecha
       , D.nro_doc
       , D.co_prov
       , PV.prov_des
       , D.tipo_doc
       , D.cob_num
       , CASE WHEN D.tipoRenglon = '5' THEN 'ADEL' ELSE '    ' END AS tipo_origen
       , D.tipo_pago AS tipo
       , CASE WHEN D.anulado = 0 THEN D.porcion_pago_doc  ELSE 0.00  END AS porcion_pago_doc
       , COALESCE(RDNCF.ncf, '') AS ncf
       , COALESCE(rdNCFSER.co_tipo_serie, '') AS co_tipo_ncf
       , COALESCE(RNC.des_tipo, SPACE(60)) AS nom_tipo_ncf
       , CASE WHEN D.anulado = 0 THEN COALESCE(PAGOS_DET.mont_cob,D.total_neto,0.00) ELSE 0.00  END AS monto_documento
       , CASE WHEN D.anulado = 0 THEN COALESCE(PAGOS_DET.mont_cob,D.total_neto,0.00) ELSE 0.00  END AS por_pagar
       , STR(D.nro_doc) + D.tipo_doc AS grupo
       , D.fec_cob
       , D.anulado
       , D.doc_num
FROM (
    SELECT 
            DOC.nro_doc
        --, COALESCE(FORMAS_PAGO.co_tipo_doc,'FACT') AS tipo_doc --Error
		, COALESCE(FORMAS_PAGO.co_tipo_doc, DOC.co_tipo_doc, 'FACT') AS tipo_doc
        , COALESCE(FORMAS_PAGO.monto_neto_doc,0) AS monto_neto_doc
        , COALESCE(CASE FORMAS_PAGO.tipo_pago
                            WHEN 'ADEL'
                            THEN FORMAS_COBROS.tipoRenglon
                            ELSE FORMAS_PAGO.tipoRenglon
                END,'0') AS tipoRenglon
        , COALESCE(FORMAS_PAGO.cob_num,0) AS cob_num
        ,
```
