# SP: pv_ActualizarFactDocVentaNControl
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pv_ActualizarNumeroControlFacDoc
*DESCRIPCIÓN	: ACTUALIZA EL NUMERO DE CONTROL EN LA FACTURA Y EN EL DOCUMENTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFactDocVentaNControl]
	( 
		@sDocNum		CHAR(20) ,
		@sNumControl	CHAR(20) ,
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6)				=	NULL ,
		@sMaquina		VARCHAR(60)			=	NULL ,
		@sCampos		VARCHAR(MAX)		=	NULL ,
		@sRevisado		CHAR(1) ,
		@sTrasnfe		CHAR(1) ,
		@tsValidador	TIMESTAMP			=	NULL ,
		@gRowguid		UNIQUEIDENTIFIER	=	NULL 
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
			UPDATE saFacturaVenta SET n_control = @sNumControl
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
			INTO @TableTimestampdFAC
			WHERE doc_num = @sDocNum

			UPDATE saDocumentoVenta SET n_control = @sNumControl
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
			INTO @TableTimestampdDOC
			WHERE nro_doc = @sDocNum AND co_tipo_doc = 'FACT'
			
			DECLARE @dtFe_In DATETIME
			DECLARE @rowGuidOriFAC UNIQUEIDENTIFIER
			DECLARE @rowGuidOriDOC UNIQUEIDENTIFIER

			SELECT
				@dtFe_In = fe_us_mo, @rowGuidOriFAC = rowGuidOriFAC
			FROM
				@TableTimestampdFAC

			SELECT
				@rowGuidOriDOC = rowguidDOC
			FROM
				@TableTimestampdDOC

			IF @dtFe_In IS NOT NULL	
				BEGIN
                  DECLARE @sPistaMensaje VARCHAR(MAX)
                  SET @sPistaMensaje = 'Actualizacion Nro control :' + RTRIM(@sNumControl) + ''
             
                  -- Insertar PistaS
                  EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                  @sTablaOri = 'saFacturaVenta', @rowguidOri = @rowGuidOriFAC, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                        @sCampos = @sPistaMensaje

                  EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                        @sTablaOri = 'saDocumentoVen
```
