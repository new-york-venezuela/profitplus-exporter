# SP: RepFacturaVentaCtaIngrEgr
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES C.A.
-- Create date: <20-03-17>
-- LASTUPDATE DATE: 2018-05-25
-- Description:	<Facturas de Venta por cuenta de ingreso/egreso>
-- =============================================
CREATE PROCEDURE [dbo].[RepFacturaVentaCtaIngrEgr]
		@sNumero_d          CHAR(20)    = NULL
	, @sNumero_h          CHAR(20)    = NULL
	, @dFecha_d           DATETIME    = NULL
	, @dFecha_h           DATETIME    = NULL
	, @sCo_cli_d          CHAR(16)    = NULL
	, @sCo_cli_h          CHAR(16)    = NULL
	, @sCo_ven_d          CHAR(6)     = NULL
	, @sCo_ven_h          CHAR(6)     = NULL
	, @sCo_tra_d          CHAR(6)     = NULL
	, @sCo_tra_h          CHAR(6)     = NULL
	, @sCo_zon_d          CHAR(6)     = NULL
	, @sCo_zon_h          CHAR(6)     = NULL
	, @sCo_seg_d          CHAR(6)     = NULL
	, @sCo_seg_h          CHAR(6)     = NULL
	, @sCo_cta_ingr_egr_d CHAR(20)    = NULL
	, @sCo_cta_ingr_egr_h CHAR(20)    = NULL
	, @sSin_Co_cta_ingr_egr CHAR(6)   = NULL
	, @sCo_mone           CHAR(6)     = NULL
	, @cStatus            CHAR(6)     = NULL
	, @cAnulado           CHAR(6)     = NULL
	, @sCo_Sucursal       CHAR(6)     = NULL
	, @sCampOrderBy       VARCHAR(16) = NULL
	, @sDir               VARCHAR(6)  = NULL
	, @bHeaderRep         BIT         = 0
AS
	BEGIN
		SET NOCOUNT ON;
		IF(@cAnulado IS NULL)
				SET @cAnulado = 'TODO'

		IF(@sSin_Co_cta_ingr_egr IS NULL)
				SET @sSin_Co_cta_ingr_egr = 'TODO'

		IF(@sDir IS NULL)
				SET @sDir = 'ASC'

		IF(@sCampOrderBy IS NULL)
				SET @sCampOrderBy = 'doc_num'

		SELECT
					COALESCE(CI.co_cta_ingr_egr, 'Z___________Z') co_cta_ingr_egr
				, COALESCE(CI.descrip, 'POR ASIGNAR') descrip
				, CASE WHEN CI.co_cta_ingr_egr IS NOT NULL THEN 'A' ELSE 'Z' END cta_order
				, FV.doc_num AS nro_fact
				, FV.fec_emis
				, CL.co_cli
				, CL.cli_des
				, FV.co_ven
				, FV.n_control
				, FV.fec_venc
				, FV.total_neto
				, FV.saldo
		FROM   saFacturaVenta AS FV
					INNER JOIN saCliente AS CL ON FV.co_cli = CL.co_cli
					LEFT JOIN saCuentaIngEgr AS CI ON FV.co_cta_ingr_egr = CI.co_cta_ingr_egr
		WHERE ((@sNumero_d IS NULL OR FV.doc_num >= @sNumero_d)
					AND (@sNumero_h IS NULL	OR FV.doc_num <= @sNumero_h))
					AND ((@dFecha_d IS NULL	OR dbo.FechaSimple(FV.fec_emis) >= @dFecha_d)
					AND (@dFecha_h IS NULL OR dbo.FechaSimple(FV.fec_emis) <= @dFecha_h))
					AND ((@sCo_cli_d IS NULL OR CL.co_cli >= @sCo_cl
```
