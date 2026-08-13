# SP: RepComprobanteDeRetencionIVA
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-26-2010>
-- Description:   <Comprobante de Retenciones Varias>
-- =============================================
CREATE PROCEDURE [dbo].[RepComprobanteDeRetencionIVA]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
--Sit.#827329 (06/02/2017)-1: Se obligó a que el nro.de registro tenga el correlativo correcto
		/* Crea la base de datos de Movimientos (Kardex - temporal) */
		BEGIN TRY
			IF EXISTS (
				SELECT *
				FROM tempdb.sys.tables
				WHERE NAME LIKE '%#tempret%'
				)
				DROP TABLE #tempret
		END TRY

		BEGIN CATCH
			PRINT 'ERROR al crear la tabla temporal especifica'
		END CATCH

		CREATE TABLE #tempret (
								registro INT, 
								nro_doc CHAR(20),
								co_tipo_doc CHAR(6), 
								fecha_docOrigen SMALLDATETIME, 
								fecha_documento SMALLDATETIME,
								fe_us_in SMALLDATETIME, 
								numero_documento CHAR(20), 
								numero_control_documento CHAR(20),
								numero_documento_afectado CHAR(20),
								monto_documento DECIMAL(18, 2), 
								base_imponible DECIMAL(18, 2), 
								monto_excento DECIMAL(18, 2),
								monto_ret_imp DECIMAL(18, 2),
								num_comprobante CHAR(16), 
								alicuota DECIMAL(18, 2) NULL,
								reten_tercero DECIMAL(18, 2) NULL,
								reten_tercero_rowguid_ori UNIQUEIDENTIFIER,
								co_prov CHAR(16),
								prov_des VARCHAR(100),
								rif VARCHAR(18),
								monto_imp DECIMAL(18, 2),
								dir_fis VARCHAR(MAX),
								dir_fis_prov VARCHAR(MAX)								
							)
--FIN Sit.#827329-1
        SET NOCOUNT ON ;
    
		declare @dir_fis varchar(254)				
		
		select @dir_fis=val_str from saAdiCampo where co_adicampo = 'DIR_FIS'
		    
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d) 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h) 

--Sit.#827329 (03/02/2017)-2:
		INSERT INTO #tempret
--FIN Sit.#827329-2
       SELECT
            rank() OVER ( ORDER BY dbo.fechasimple(A.fecha_documento), A.fe_us_in, A.nro_doc, A.co_tipo_doc, A.alicuota, A.num_comprobante, A.reten_tercero, A.monto_documento )
            AS registro,
			A.nro_doc , A.co_tipo_
```
