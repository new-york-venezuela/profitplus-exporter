# SP: pv_ActualizarDatosFactIMPL
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pv_ActualizarDatosFactIMPL]
/**************************************************************************
*NOMBRE			: [pv_ActualizarDatosFactIMPL]
*DESCRIPCIÓN	: Actualiza los datos de impresora fiscal en la factura de cliente y documento de venta
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
(
   @sDocNum		CHAR(20),
   @sImpfis		CHAR(20),
   @sImpfisfac	CHAR(20),
   @sUltZ		CHAR(15),
   @sCo_Us_Mo	CHAR(6) ,
   @sCo_Sucu_Mo CHAR(6)				=	NULL ,
   @sMaquina	VARCHAR(60)			=	NULL ,
   @sCampos		VARCHAR(MAX)		=	NULL ,
   @sRevisado	CHAR(1) ,
   @sTrasnfe	CHAR(1) ,
   @tsValidador TIMESTAMP			=	NULL ,
   @gRowguid	UNIQUEIDENTIFIER	=	NULL 
)
AS
BEGIN
		DECLARE @TableTimestampdFAC TABLE
				(
				  validador VARBINARY(MAX) ,
				  fe_us_in DATETIME ,
				  fe_us_mo DATETIME ,
				  rowGuidOriFAC UNIQUEIDENTIFIER
				)

			DECLARE @TableTimestampdDOC TABLE
				(
				  validador VARBINARY(MAX) ,
				  fe_us_in DATETIME ,
				  fe_us_mo DATETIME ,
				  rowguidDOC UNIQUEIDENTIFIER
				)

				DECLARE @fecha_actual DATE = CAST(GETDATE() AS DATE)

      UPDATE saFacturaVenta SET impfis = @sImpfis , impfisfac  = @sImpfisfac ,campo8 = 1, imp_nro_z = @sUltZ
	  , fe_us_in = GETDATE() , fe_us_mo = GETDATE() 
		
		, fec_emis = CASE 
                  WHEN CAST(fec_emis AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_emis
               END,
		  fec_reg = CASE 
                  WHEN CAST(fec_reg AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_reg
               END,
          fec_venc = CASE 
                  WHEN CAST(fec_venc AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_venc
               END
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdFAC
         WHERE doc_num = @sDocNum

      UPDATE saDocumentoVenta SET impfis = @sImpfis , impfisfac  = @sImpfisfac ,campo8 = 1, imp_nro_z = @sUltZ
	  , fe_us_in = GETDATE() , fe_us_mo = GETDATE() 
		
		, fec_emis = CASE 
                  WHEN CAST(fec_emis AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_emis
               END,
		  fec_reg = CASE 
                  WHEN CAST(fec_reg AS DATE) = @fecha_actual THEN GETDATE()
                  ELSE fec_reg
               END,
          fec_venc = CASE 
                  WHEN CAST(fec_venc
```
