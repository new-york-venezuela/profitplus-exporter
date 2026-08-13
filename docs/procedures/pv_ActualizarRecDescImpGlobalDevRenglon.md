# SP: pv_ActualizarRecDescImpGlobalDevRenglon
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarRecDescImpGlobalDevRenglon]
*DESCRIPCIÓN	: ACTUALIZA LOS MONTOS DESCUENTO, RECARGO E IMPUESTO GLOBAL DE TODOS LOS RENGLONES 
				  DE UNA DEVOLUCION DADA
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROC [dbo].[pv_ActualizarRecDescImpGlobalDevRenglon]
(
		@sNumDoc			CHAR(20),
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
		DECLARE @TableTimestamp TABLE
				(
				  fe_us_in DATETIME ,
				  fe_us_mo DATETIME ,
				  rowguid UNIQUEIDENTIFIER
				)

		Declare @deTotalBruto decimal(18,2)
		Declare @monto_desc_glob decimal(18,2)
		Declare @monto_reca decimal(18,2)
		SELECT @deTotalBruto = total_bruto FROM saDevolucionCliente WHERE doc_num = @sNumDoc;
		SELECT @monto_desc_glob = monto_desc_glob FROM saDevolucionCliente WHERE doc_num = @sNumDoc;
		SELECT @monto_reca = monto_reca FROM saDevolucionCliente WHERE doc_num = @sNumDoc;

		UPDATE saDevolucionClienteReng SET
			monto_reca_glob = ROUND(( @monto_reca * reng_neto) / @deTotalBruto, 2),
			monto_desc_glob = ROUND(( @monto_desc_glob * reng_neto ) / @deTotalBruto, 2)
			--Monto_imp_afec_glob = ROUND(( ( reng_neto + monto_reca_glob - monto_desc_glob ) * porc_imp ) / 100, 5)- monto_imp
				 --OUTPUT inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					--INTO @TableTimestamp
				WHERE  doc_num = @sNumDoc
     
		UPDATE saDevolucionClienteReng SET
			Monto_imp_afec_glob = ROUND(( ( reng_neto + monto_reca_glob - monto_desc_glob ) * porc_imp ) / 100, 2)- monto_imp
				 OUTPUT inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
				WHERE  doc_num = @sNumDoc


		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDevolucionClienteReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sNumDoc
    END
```
