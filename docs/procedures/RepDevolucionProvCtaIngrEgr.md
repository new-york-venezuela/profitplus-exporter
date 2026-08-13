# SP: RepDevolucionProvCtaIngrEgr
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES C.A.
-- Create date: <21-03-2017>
-- Modify date: <25-05-2018>
-- Description:	<Devoluciones a proveedores por cuenta de ingreso/egreso>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionProvCtaIngrEgr]
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
	, @cAnulado             CHAR(6)     = NULL
	, @sCo_Sucursal         CHAR(6)     = NULL
	, @sCampOrderBy         VARCHAR(16) = NULL
	, @sDir                 VARCHAR(6)  = NULL
	, @bHeaderRep           BIT         = 0
AS
	BEGIN
			SET NOCOUNT ON

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
					, DP.doc_num
					, DP.fec_emis
					, PR.co_prov
					, PR.prov_des
					, DP.n_control
					, DP.fec_venc
					, CASE
								WHEN DP.anulado = 1
								THEN 0.00
								ELSE DP.total_neto
						END AS total_neto
					, CASE
								WHEN DP.anulado = 1
								THEN 0.00
								ELSE DP.saldo
						END AS saldo
					, DP.anulado
			FROM  saDevolucionProveedor AS DP
						INNER JOIN saProveedor AS PR ON DP.co_prov = PR.co_prov
						LEFT JOIN saCuentaIngEgr AS CI ON DP.co_cta_ingr_egr = CI.co_cta_ingr_egr
			WHERE ((@sNumero_d IS NULL OR DP.doc_num >= @sNumero_d)
							AND (@sNumero_h IS NULL OR DP.doc_num <= @sNumero_h))
							AND ((@dFecha_d IS NULL OR dbo.FechaSimple(DP.fec_emis) >= @dFecha_d)
							AND (@dFecha_h IS NULL OR dbo.FechaSimple(DP.fec_emis) <= @dFecha_h))
```
