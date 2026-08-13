# SP: pObtenerRetencionIvaVsDocumentoCompra
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerRetencionIvaVsDocumentoCompra]
DESCRIPCION:	Obtener la retención de iva
CREADO POR:		SOFTECH SISTEMAS
FECHA:			27/09/2010
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRetencionIvaVsDocumentoCompra]
    (
      @sNro_Doc CHAR(20) ,
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
                        saDocumentoCompra
                    WHERE
                        co_tipo_doc = @sCo_Tipo_Doc
                        AND nro_doc = @sNro_Doc
                        AND aut = 0 ) 
            BEGIN --[FACTURAS]/[NOTAS DE CREDITO] MANUALES AGRUPABA EL DETALLE EN UNO SOLO 
                                         
	 			SELECT --AGRUPA SOLO POR ALICUOTA 
    DC.co_prov,
    P.rif AS rif_comprador,
    P.porc_esp AS porc_reten,
    DC.num_comprobante,
    DR.porc_imp AS alicuota,
   SUM(CASE WHEN DR.porc_imp = 0 THEN 0 ELSE DR.reng_neto - DR.monto_desc_glob + DR.monto_reca_glob END) AS base_imponible,
    --SUM(DR.reng_neto - DR.monto_desc + DR.monto_reca_glob + DR.monto_imp + DR.monto_imp_afec_glob) AS monto_documento,
	 SUM(CASE 
										WHEN DR.porc_imp = 0 THEN 0 
										ELSE DR.reng_neto - DR.monto_desc - DR.monto_desc_glob + DR.monto_reca_glob + DR.monto_imp + DR.monto_imp_afec_glob 
									END) AS monto_documento,
    DC.n_control AS numero_control_documento,
    DC.nro_fact AS numero_documento,
	DR.tipo_imp,
   ROUND((SUM(CASE WHEN DR.porc_imp = 0 THEN 0 ELSE DR.reng_neto - DR.monto_desc_glob + DR.monto_reca_glob END) * DR.porc_imp) / 100, 2) AS monto_imp,
  ROUND((ROUND((SUM(CASE WHEN DR.porc_imp = 0 THEN 0 ELSE DR.reng_neto - DR.monto_desc_glob + DR.monto_reca_glob END) * DR.porc_imp) / 100, 2) * P.porc_esp) / 100, 5) AS
```
