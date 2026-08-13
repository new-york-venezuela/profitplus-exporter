# SP: RepDevolucionClienteCtaIngrEgr
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES C.A.
-- Create date: <20-03-17>
-- LASTUPDATE DATE: 2018-05-25
-- Description:	<Devolucion Cliente por cuenta de ingreso/egreso>
-- =============================================
CREATE PROCEDURE [dbo].[RepDevolucionClienteCtaIngrEgr]
		@cNumero_d          CHAR(20)    = NULL
	, @cNumero_h          CHAR(20)    = NULL
	, @dFecha_d           DATETIME    = NULL
	, @dFecha_h           DATETIME    = NULL
	, @cCo_cli_d          CHAR(16)    = NULL
	, @cCo_cli_h          CHAR(16)    = NULL
	, @cCo_ven_d          CHAR(6)     = NULL
	, @cCo_ven_h          CHAR(6)     = NULL
	, @cCo_tra_d          CHAR(6)     = NULL
	, @cCo_tra_h          CHAR(6)     = NULL
	, @cCo_zon_d          CHAR(6)     = NULL
	, @cCo_zon_h          CHAR(6)     = NULL
	, @cCo_seg_d          CHAR(6)     = NULL
	, @cCo_seg_h          CHAR(6)     = NULL
	, @cCo_cta_ingr_egr_d CHAR(20)    = NULL
	, @cCo_cta_ingr_egr_h CHAR(20)    = NULL
	, @sSin_Co_cta_ingr_egr CHAR(6)   = NULL
	, @cCo_mone           CHAR(6)     = NULL
	, @cAnulado           CHAR(6)     = NULL
	, @cCo_Sucursal       CHAR(6)     = NULL
	, @sCampOrderBy       VARCHAR(16) = NULL
	, @sDir               VARCHAR(6)  = NULL
	, @bHeaderRep         BIT         = 0
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
				, DC.doc_num AS nro_fact
				, DC.fec_emis
				, CL.co_cli
				, CL.cli_des
				, DC.co_ven
				, DC.n_control
				, DC.fec_venc
				, DC.total_neto
				, DC.saldo
		FROM   saDevolucionCliente AS DC
					INNER JOIN saCliente AS CL ON DC.co_cli = CL.co_cli
					LEFT JOIN saCuentaIngEgr AS CI ON DC.co_cta_ingr_egr = CI.co_cta_ingr_egr
		WHERE ((@cNumero_d IS NULL OR DC.doc_num >= @cNumero_d)
					AND (@cNumero_h IS NULL OR DC.doc_num <= @cNumero_h)) 
					AND ((@dFecha_d IS NULL	OR dbo.FechaSimple(DC.fec_emis) >= @dFecha_d)
					AND (@dFecha_h IS NULL OR dbo.FechaSimple(DC.fec_emis) <= @dFecha_h))
					AND ((@cCo_cli_d IS NULL OR CL.co_cli >= @cCo_cli_d)
					AND (@cCo_cli_h IS
```
