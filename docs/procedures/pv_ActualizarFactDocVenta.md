# SP: pv_ActualizarFactDocVenta
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarFactDocVenta]
*DESCRIPCIÓN	: ACTUALIZA EL ENCABEZADO DE LA FACTURA DE VENTA Y DOCUMENTO DE VENTA AL MOMENTO DE 
				  PROCESAR EL COBRO DESDE PUNTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFactDocVenta]
(		
		@sDoc_num			CHAR(20),
        @sCo_ven			CHAR(6),
        @deTotal_bruto		DECIMAL (18,2),
        @deTotal_neto		DECIMAL (18,2), 
        @deMonto_imp		DECIMAL (18,2),
        @sPorc_desc_glob	VARCHAR (15), 
        @deMonto_desc_glob	DECIMAL (18,2), 
        @sPorc_reca			VARCHAR(15), 
        @deMonto_reca		DECIMAL (18,2),
        @sComentario		VARCHAR(MAX), 
        @sDir_ent			VARCHAR(MAX), 
        @sCo_Us_Mo			CHAR(6) ,
		@sCo_Sucu_Mo		CHAR(6)				=	NULL ,
		@sMaquina			VARCHAR(60)			=	NULL ,
		@sCampos			VARCHAR(MAX)		=	NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1) ,
		@tsValidador		TIMESTAMP			=	NULL ,
		@gRowguid			UNIQUEIDENTIFIER	=	NULL 
	)
AS
BEGIN
			DECLARE @TableTimestampdFACT TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidFACT UNIQUEIDENTIFIER
            )

			DECLARE @TableTimestampdDOC TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidDOC UNIQUEIDENTIFIER
            )

            UPDATE saFacturaVenta 
				SET total_neto		=		@deTotal_neto,
					total_bruto		=		@deTotal_bruto, 
					monto_imp		=		@deMonto_imp,
					saldo			=		0,
					monto_desc_glob =		@deMonto_desc_glob, 
					porc_desc_glob	=		@sPorc_desc_glob, 
					porc_reca		=		@sPorc_reca,
					monto_reca		=		@deMonto_reca,
					co_us_mo		=		@sCo_Us_Mo,
					co_sucu_mo		=		@sCo_Sucu_Mo,
					comentario		=		@sComentario, 
					dir_ent			=		@sDir_ent, 
					co_ven			=		@sCo_ven 
						OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdFACT
                  WHERE doc_num		=		@sDoc_num

			UPDATE saDocumentoVenta 
				SET	total_neto		=		@deTotal_neto,
					total_bruto		=		@deTotal_bruto,
					monto_imp		=		@deMonto_imp,
					saldo			=		0,
					porc_imp		=		0, 
					tipo_origen		=		0,
					monto_desc_glob =		@deMonto_desc_glob,
```
