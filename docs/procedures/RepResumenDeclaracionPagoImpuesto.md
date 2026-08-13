# SP: RepResumenDeclaracionPagoImpuesto
**Tipo**: Reporte
**Módulo**: Tesorería

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/23/2011>
-- Last Update: 2019-09-30
-- Description:	<Reporte de Libro de Ventas>
-- =============================================
CREATE PROCEDURE [dbo].[RepResumenDeclaracionPagoImpuesto]
	-- Add the parameters for the stored procedure here
	@sCo_fecha_d SMALLDATETIME = NULL, 
	@sCo_fecha_h SMALLDATETIME = NULL, 
	@dExced DECIMAL(18, 2) = 0, 
	@dRet DECIMAL(18, 2) = 0, 
	@bIncRetPro VARCHAR(2) = 'NO', 
	@sCampOrderBy VARCHAR(16) = NULL, 
	@sDir VARCHAR(6) = NULL,
	@bHeaderRep BIT = 0, 
	@dCredFisToD DECIMAL(18, 2) = 0 -- mfreitez

AS
	BEGIN
		SET NOCOUNT ON;

	--Se crea estas variables para los exentos con tasa cero(0) y exentos de los campos otros
	DECLARE @monto_exento AS DECIMAL(18,2),
			@monto_otros AS DECIMAL(18,2),
			@monto_exento_compras AS DECIMAL(18,2),
			@monto_otros_compras AS DECIMAL(18,2)

	IF @sCo_fecha_h IS NOT NULL
		SET @sCo_fecha_h = DATEADD(ss, - 60, DATEADD(day, 1, @sCo_fecha_h))
	  
	DECLARE		
				@nro_doc CHAR(20),
				@co_tipo_doc CHAR(6), 
				@total_neto DECIMAL(18, 2), 
				@nac BIT, 
				@anulado BIT, 
				@base_imp DECIMAL(18, 2), 
				@tasa DECIMAL(18, 2), 
				@monto_imp DECIMAL(18, 2), 
				@ventas_exentas DECIMAL(18, 2), 
				@compras_exentas DECIMAL(18, 2), 
				@ldescrip VARCHAR(100), 
				@old_nro_doc CHAR(20), 
				@old_co_tipo_doc CHAR(6), 
				@old_tasa DECIMAL(18, 5), 
				@lupdate INT, 
				@cont INT,
				@base_imp_tot DECIMAL(18, 2), 
				@monto_imp_tot DECIMAL(18, 2), 
				@total_iva_ventas DECIMAL(18, 2), 
				@total_iva_compras DECIMAL(18, 2), 
				@total_ret_cli DECIMAL(18, 2), 
				@total_ret_prov DECIMAL(18, 2), 
				@total_ventas_gravadas DECIMAL(18, 2), 
				@total_ventas_general DECIMAL(18, 2),
				@base_imponible_scf DECIMAL(18, 2), 
				@monto_imp_scf DECIMAL(18, 2), 
				@sin_der_cre_fis BIT, 
				@creditos_fisc_total_deduc DECIMAL(18, 2),
				@factor_r DECIMAL(18, 2),
				@fecha_emis SMALLDATETIME,
				@n_control CHAR(20)

	DECLARE		@nro_doc_ant CHAR(20), 
				@co_tipo_doc_ant CHAR(6), 
				@x SMALLINT
  
	/* Crea la base de datos de Movimientos (Kardex - temporal) */
	BEGIN TRY
		IF EXISTS (
				SELECT *
				FROM tempdb.sys.tables
				WHERE NAME LIKE '%#tempfinal%'
				)
			BEGIN
				DROP TABLE #tempfinal
			END
	END TRY

	BEGIN CATCH
		PRINT 'ERROR al crear la tabla temporal especifica'
	END CATCH
		--Se crea la Tabla T
```
