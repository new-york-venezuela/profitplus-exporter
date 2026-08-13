# SP: pv_ActualizarRecDescImpGlobalFactRenglon
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ActualizarRecDescImpGlobalFactRenglon]
*DESCRIPCIÓN	:	ACTUALIZA LOS MONTOS DESCUENTO, RECARGO E IMPUESTO GLOBAL EN TODOS LOS RENGLONES DE 
					UNA FACTURA DADA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarRecDescImpGlobalFactRenglon]

		@sNumDoc			CHAR(20),
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
		DECLARE @TableTimestamp TABLE
				(
				  fe_us_in DATETIME ,
				  fe_us_mo DATETIME ,
				  rowguid UNIQUEIDENTIFIER
				)

		Declare @deTotalBruto decimal(18,2)
		Declare @monto_desc_glob decimal(18,2)
		Declare @monto_reca decimal(18,2)
		SELECT @deTotalBruto = total_bruto FROM saFacturaVenta WHERE doc_num = @sNumDoc;
		SELECT @monto_desc_glob = monto_desc_glob FROM saFacturaVenta WHERE doc_num = @sNumDoc;
		SELECT @monto_reca = monto_reca FROM saFacturaVenta WHERE doc_num = @sNumDoc;
		
		UPDATE saFacturaVentaReng
			SET monto_desc_glob		= ROUND((@monto_desc_glob	* reng_neto ) / @deTotalBruto, 2),
				monto_reca_glob		= ROUND((@monto_reca		* reng_neto ) / @deTotalBruto, 2)
			WHERE doc_num = @sNumDoc
 
		UPDATE saFacturaVentaReng
			SET Monto_imp_afec_glob	= ROUND(( ( reng_neto + monto_reca_glob - monto_desc_glob ) * porc_imp ) / 100, 2) - monto_imp 
							OUTPUT inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			WHERE doc_num = @sNumDoc

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		      IF @dtFe_In IS NOT NULL 
            BEGIN
                  DECLARE @sPistaMensaje VARCHAR(MAX)
                  SET @sPistaMensaje = 'Actualizacion recargo y descuento global.'
                  -- Insertar Pista
                  EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                  @sTablaOri = 'saFacturaVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                  @sCampos = @sPistaMensaje
            END

    END
```
