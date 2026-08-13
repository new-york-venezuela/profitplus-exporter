# SP: pv_ActualizarFactDocVtaRecDesc
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pv_ActualizarFactDocVtaRecDesc
*DESCRIPCIÓN	: ACTUALIZA EL PORCENTAJE Y MONTO DESCUENTO Y RECARGO DE UNA FACTURA/DOCUMENTO DADO
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFactDocVtaRecDesc]

		@sDoc_Num			CHAR(20),
		@sPorc_Desc_Glob	VARCHAR(15),
		@deMonto_Desc_Glob	DECIMAL(18,2),
		@sPorc_Reca			VARCHAR(15),
		@deMonto_reca		DECIMAL(18,2),
		@sCo_Us_Mo			CHAR(6) ,
		@sCo_Sucu_Mo		CHAR(6)				=	NULL ,
		@sMaquina			VARCHAR(60)			=	NULL ,
		@sCampos			VARCHAR(MAX)		=	NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1) ,
		@tsValidador		TIMESTAMP			=	NULL ,
		@gRowguid			UNIQUEIDENTIFIER	=	NULL 
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

			UPDATE saFacturaVenta SET 
				Porc_Desc_Glob = @sPorc_Desc_Glob, 
				Monto_Desc_Glob = @deMonto_Desc_Glob,
				Porc_Reca = @sPorc_Reca ,
				Monto_reca = @deMonto_reca
					OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdFAC 
			WHERE doc_num = @sDoc_Num

			UPDATE saDocumentoVenta SET 
				Porc_Desc_Glob = @sPorc_Desc_Glob, 
				Monto_Desc_Glob = @deMonto_Desc_Glob,
				Porc_Reca = @sPorc_Reca ,
				Monto_reca = @deMonto_reca
					OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
						  INTO @TableTimestampdDOC 
			WHERE nro_doc = @sDoc_Num AND co_tipo_doc = 'FACT'

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
		-- Insertar PistaS
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFacturaVenta', @rowguidOri = @rowGuidOriFAC, @sTipo_Op =
```
