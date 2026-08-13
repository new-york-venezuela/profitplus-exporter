# SP: pObtenerRetencionTercerosIvaVsDocumentoCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerRetencionTercerosIvaVsDocumentoCompra]
DESCRIPCION:	Obtener la retención de iva
CREADO POR:		SOFTECH SISTEMAS
FECHA:			22/09/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerRetencionTercerosIvaVsDocumentoCompra]
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

        IF @sCo_Tipo_Doc = 'FACT' 
            BEGIN
                IF ( @sdFecha_Pago IS NULL ) 
                    SET @fecha = GETDATE()
                ELSE 
                    SET @fecha = @sdFecha_Pago
		
                SET @anhoMes = CAST(DATEPART(YEAR, @fecha) AS VARCHAR) + ( REPLICATE('0',
                                                                                     2 - LEN(DATEPART(MONTH, @fecha)))
                                                                           + CAST(DATEPART(MONTH, @fecha) AS VARCHAR) )
	
                SELECT
                    FCR.co_art, a.art_des, A.reten_iva_tercero AS co_prov, P.rif AS rif_comprador,
                    P.porc_esp AS porc_reten, DC.num_comprobante,
                    ( ( FCR.cost_unit * FCR.total_art ) - FCR.monto_desc - FCR.monto_desc_glob + FCR.monto_reca_glob )
                    AS base_imponible,
                    ( ( ( FCR.cost_unit * FCR.total_art ) - FCR.monto_desc - FCR.monto_desc_glob + FCR.monto_reca_glob )
                      + FCR.monto_imp + FCR.monto_imp_afec_glob ) AS monto_documento,
                    DC.n_control AS numero_control_documento, DC.nro_fact AS numero_documento, FCR.tipo_imp,
                    FCR.porc_imp AS alicuota, ( FCR.monto_imp + FCR.monto_imp_afec_glob ) monto_imp,
                    ROUND(( ( FCR.monto_imp + FCR.monto_imp_afec_glob ) * P.porc_esp ) / 100, 2) AS monto_ret_imp,
                    @sdFecha_Pago AS fecha_documento, 'C' AS tipo_operacion, DC.co_tipo_doc AS tipo_documento,
                    @anhoMes AS periodo_impositivo, TD.tipo_mov,
                    
                    (SELECT
						SUM(FC1.reng_neto - FC1.monto_desc_glob + FC1.monto_reca_glob)
						FROM
						sa
```
