# SP: RepDocumentoCxPCtaIngrEgr
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES C.A.
-- Create date: <21-03-2017>
-- Modify date: <10-06-2021>
-- Description:	<Documentos de CxP por cuenta de ingreso/egreso>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCxPCtaIngrEgr]
		@sNumero_d            CHAR(20)    = NULL
	, @sNumero_h            CHAR(20)    = NULL
	, @dFecha_d             DATETIME    = NULL
	, @dFecha_h             DATETIME    = NULL
	, @sCo_pro_d            CHAR(16)    = NULL
	, @sCo_pro_h            CHAR(16)    = NULL
	, @sCo_zon_d            CHAR(6)     = NULL
	, @sCo_zon_h            CHAR(6)     = NULL
	, @sCo_seg_d            CHAR(6)     = NULL
	, @sCo_seg_h            CHAR(6)     = NULL
	, @sCo_cta_ingr_egr_d   CHAR(20)    = NULL
	, @sCo_cta_ingr_egr_h   CHAR(20)    = NULL
	, @sSin_Co_cta_ingr_egr CHAR(6)     = NULL
	, @sCo_mone             CHAR(6)     = NULL
	, @sCo_Condic           CHAR(6)     = NULL
	, @sCo_Sucursal         CHAR(6)     = NULL
	, @sCampOrderBy         VARCHAR(16) = NULL
	, @sDir                 VARCHAR(6)  = NULL
	, @bHeaderRep           BIT         = 0
AS
	BEGIN
			SET NOCOUNT ON

			IF(@sSin_Co_cta_ingr_egr IS NULL)
					SET @sSin_Co_cta_ingr_egr = 'TODO'

			IF(@sDir IS NULL)
					SET @sDir = 'ASC'

			IF(@sCampOrderBy IS NULL)
					SET @sCampOrderBy = 'nro_doc'

			DECLARE @fechadiff INT

			SET @fechadiff = DATEDIFF(dd, 00, GETDATE())

			SELECT
						COALESCE(CI.co_cta_ingr_egr, 'Z___________Z') co_cta_ingr_egr
					, COALESCE(CI.descrip, 'POR ASIGNAR') descrip
					, CASE WHEN CI.co_cta_ingr_egr IS NOT NULL THEN 'A' ELSE 'Z' END cta_order
					, DC.nro_doc
					, DC.fec_emis
					, PR.co_prov
					, PR.prov_des
					, DC.n_control
					, DC.fec_venc
					, CASE
								WHEN DC.anulado = 1
								THEN 0.00
								ELSE DC.total_neto
						END AS total_neto
					, CASE
								WHEN DC.anulado = 1
								THEN 0.00
								ELSE DC.saldo
						END AS saldo
					, DC.anulado
					, DC.co_tipo_doc
					, TP.tipo_mov
			FROM   saDocumentoCompra AS DC
						INNER JOIN saProveedor AS PR ON DC.co_prov = PR.co_prov
						LEFT JOIN saCuentaIngEgr AS CI ON DC.co_cta_ingr_egr = CI.co_cta_ingr_egr
						LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DC.co_tipo_doc
			WHERE ((@sNumero_d IS NULL OR DC.nro_doc >= @sNumero_d)
						AND (@sNumero_h IS NULL OR DC.nro_doc <= @sNumero_h))
						AND ((@dFecha_d IS NULL OR dbo.
```
