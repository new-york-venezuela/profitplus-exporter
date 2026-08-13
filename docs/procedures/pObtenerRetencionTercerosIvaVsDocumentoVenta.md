# SP: pObtenerRetencionTercerosIvaVsDocumentoVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerRetencionTercerosIvaVsDocumentoVenta]
DESCRIPCION:	Obtener la retención de iva
CREADO POR:		SOFTECH SISTEMAS
FECHA:			22/09/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerRetencionTercerosIvaVsDocumentoVenta]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sdFecha_Pago SMALLDATETIME
    )
AS 
    DECLARE @anhoMes DECIMAL
    DECLARE @fecha SMALLDATETIME
    BEGIN

	/* NOTA: para la fecha 27/09/2010 solo se manejan retenciones de IVA a terceros para facturas */
	
        IF ( @sdFecha_Pago IS NULL ) 
            SET @fecha = GETDATE()
        ELSE 
            SET @fecha = @sdFecha_Pago
		
        SET @anhoMes = CAST(DATEPART(YEAR, @fecha) AS VARCHAR) + ( REPLICATE('0', 2 - LEN(DATEPART(MONTH, @fecha)))
                                                                   + CAST(DATEPART(MONTH, @fecha) AS VARCHAR) )

        IF @sCo_Tipo_Doc = 'FACT' 
            BEGIN
                SELECT
                    FVR.co_art, FVR.des_art, A.reten_iva_tercero AS co_cli, C.rif AS rif_comprador,
                    C.porc_esp AS porc_reten, DV.num_comprobante,
                    ( ( FVR.prec_vta * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob + FVR.monto_reca_glob ) AS base_imponible,
                    ( ( ( FVR.prec_vta * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob + FVR.monto_reca_glob )
                      + ( FVR.otros1_glob + FVR.otros2_glob + FVR.otros3_glob ) + FVR.monto_imp ) AS monto_documento,
                    ISNULL(DV.n_control, 0) AS numero_control_documento, '' AS numero_documento, FVR.tipo_imp,
                    FVR.porc_imp AS alicuota, ( FVR.monto_imp + FVR.monto_imp_afec_glob ) monto_imp,
                    ROUND(( ( FVR.monto_imp + FVR.monto_imp_afec_glob ) * C.porc_esp ) / 100, 2) AS monto_ret_imp,
                    @sdFecha_Pago AS fecha_documento, 'C' AS tipo_operacion, DV.co_tipo_doc AS tipo_documento,
                    @anhoMes AS periodo_impositivo, TD.tipo_mov,
                    ( ( FV.otros1 + FV.otros2 + FV.otros3 )
                      + ISNULL(( SELECT
                                    SUM(reng_neto - monto_desc_glob + monto_reca_glob)
                                 FROM
```
