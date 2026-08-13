# SP: pObtenerRetencionIvaVsDocumentoVenta
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerRetencionIvaVsDocumentoVenta]
DESCRIPCION:	Obtener la retención de iva
CREADO POR:		SOFTECH SISTEMAS
FECHA:			27/09/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRetencionIvaVsDocumentoVenta]
    (
      @sNro_Doc VARCHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sdFecha_Pago SMALLDATETIME
    )
AS 
    DECLARE @anhoMes DECIMAL
    DECLARE @fecha SMALLDATETIME
    BEGIN
        IF ( @sdFecha_Pago IS NULL ) 
            SET @fecha = GETDATE()
        ELSE 
            SET @fecha = @sdFecha_Pago
              
        SET @anhoMes = CAST(DATEPART(YEAR, @fecha) AS VARCHAR) + ( REPLICATE('0', 2 - LEN(DATEPART(MONTH, @fecha)))
                                                                   + CAST(DATEPART(MONTH, @fecha) AS VARCHAR) )
       
        IF EXISTS ( SELECT
                        co_tipo_doc
                    FROM
                        saDocumentoVenta
                    WHERE
                        co_tipo_doc = @sCo_Tipo_Doc
                        AND nro_doc = @sNro_Doc
                        AND aut = 0 
						) 
            BEGIN --[FACTURAS]/[NOTAS DE CREDITO] MANUALES
                     
                SELECT
                    DV.co_cli, P.rif AS rif_Comprador, P.porc_esp AS porc_reten, DV.num_comprobante,
                    ( DV.total_bruto - DV.monto_desc_glob + DV.monto_reca -ISNULL((select sum (reng_neto - monto_desc_glob + monto_reca_glob) from saDocumentoVentaReng where co_tipo_doc =@sCo_Tipo_Doc and nro_doc = @sNro_Doc  and porc_imp=0), 0 )) AS base_imponible,--DN 270622
                    --( DV.total_bruto - DV.monto_desc_glob + DV.monto_reca + DV.monto_imp ) AS monto_documento,
					ISNULL((select sum(reng_neto -monto_desc-monto_desc_glob +monto_reca_glob +monto_imp+monto_imp_afec_glob ) from saDocumentoVentaReng where co_tipo_doc =@sCo_Tipo_Doc and nro_doc = @sNro_Doc  and porc_imp>0), ( DV.total_bruto - DV.monto_desc_glob + DV.monto_reca + DV.monto_imp ) ) AS monto_documento,--DN 270622
                    ISNULL(DV.n_control, 0) AS numero_control_documento, DV.tipo_imp, 
					ISNULL((select max (porc_imp) from saDocumentoVentaReng where co_tipo_doc =@sCo_Tipo_Doc and nro_doc = @sNro_Doc), DV.porc_imp ) AS alicuota, --DN27062022--DV.porc_i
```
