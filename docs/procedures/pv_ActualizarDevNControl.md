# SP: pv_ActualizarDevNControl
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pv_ActualizarNumeroControlFacDoc
*DESCRIPCIÓN	: ACTUALIZA EL NUMERO DE CONTROL EN LA FACTURA Y EN EL DOCUMENTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarDevNControl]
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


			DECLARE @TableTimestampdDOC TABLE
				(
				  validador VARBINARY(MAX) ,
				  fe_us_in DATETIME ,
				  fe_us_mo DATETIME ,
				  rowguidDOC UNIQUEIDENTIFIER
				)

			UPDATE saDocumentoVenta SET n_control = @sNumControl
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
			INTO @TableTimestampdDOC
			WHERE nro_doc = @sDocNum AND co_tipo_doc = 'N/CR'
			
			DECLARE @dtFe_In DATETIME
			DECLARE @rowGuidOriFAC UNIQUEIDENTIFIER
			DECLARE @rowGuidOriDOC UNIQUEIDENTIFIER


			SELECT
				@rowGuidOriDOC = rowguidDOC
			FROM
				@TableTimestampdDOC

			IF @dtFe_In IS NOT NULL	
				BEGIN
					-- Insertar PistaS

					EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOriDOC, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sDocNum
				END
END
```
