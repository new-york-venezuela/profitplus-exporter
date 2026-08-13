# SP: RepDocumentoCxCCtaIngrEgr
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES C.A.
-- Create date: <21-03-17>
-- LASTUPDATE DATE: 2021-06-10
-- Description:	<Documentos de CxP por cuenta de ingreso/egreso>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCxCCtaIngrEgr]
		@cNumero_d          CHAR(20)    = NULL
	, @cNumero_h          CHAR(20)    = NULL
	, @dFecha_d           DATETIME    = NULL
	, @dFecha_h           DATETIME    = NULL
	, @cCo_cli_d          CHAR(16)    = NULL
	, @cCo_cli_h          CHAR(16)    = NULL
	, @cCo_ven_d          CHAR(6)     = NULL
	, @cCo_ven_h          CHAR(6)     = NULL
	, @cCo_zon_d          CHAR(6)     = NULL
	, @cCo_zon_h          CHAR(6)     = NULL
	, @cCo_seg_d          CHAR(6)     = NULL
	, @cCo_seg_h          CHAR(6)     = NULL
	, @cCo_cta_ingr_egr_d CHAR(20)    = NULL
	, @cCo_cta_ingr_egr_h CHAR(20)    = NULL
	, @sSin_Co_cta_ingr_egr CHAR(6)   = NULL
	, @cTipo              CHAR(6)     = NULL
	, @cCo_mone           CHAR(6)     = NULL
	, @sCo_Condic         CHAR(6)     = NULL
	, @sCo_Sucursal       CHAR(6)     = NULL
	, @sCampOrderBy       VARCHAR(16) = NULL
	, @sDir               VARCHAR(6)  = NULL
	, @bHeaderRep         BIT         = 0
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
				, DV.nro_doc
				, DV.fec_emis
				, CL.co_cli
				, CL.cli_des
				, DV.co_ven
				, DV.fec_venc
				, DV.total_neto
				, DV.saldo
				, TP.tipo_mov
		FROM   saDocumentoVenta AS DV
					INNER JOIN saCliente AS CL ON DV.co_cli = CL.co_cli
					LEFT JOIN saCuentaIngEgr AS CI ON DV.co_cta_ingr_egr = CI.co_cta_ingr_egr
					LEFT JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = DV.co_tipo_doc
		WHERE ((@cNumero_d IS NULL OR DV.nro_doc >= @cNumero_d)
					AND (@cNumero_h IS NULL OR DV.nro_doc <= @cNumero_h))
					AND ((@dFecha_d IS NULL OR dbo.FechaSimple(DV.fec_emis) >= @dFecha_d)
					AND (@dFecha_h IS NULL OR dbo.FechaSimple(DV.fec_emis) <= @dFecha_h))
					AND ((@cCo_cli_d IS NULL OR CL.co_cli >= @cCo_cl
```
