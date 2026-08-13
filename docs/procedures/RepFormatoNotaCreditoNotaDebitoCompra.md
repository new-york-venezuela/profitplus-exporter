# SP: RepFormatoNotaCreditoNotaDebitoCompra
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraInfoIGTF`](../tables/saDocumentoCompraInfoIGTF.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23/08/2022>
-- Description:
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoNotaCreditoNotaDebitoCompra] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    -- Insert statements for procedure here
        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'docucompra' ;
	
        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 0, ( CL.prov_des ) AS cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, --VE.ven_des, 
            DV.co_tipo_doc, DV.nro_doc, ( DV.co_prov ) AS co_cli, /*DV.co_ven,*/ DV.co_mone, DV.tasa, DV.observa,
            DV.fec_emis, DV.fec_venc, DV.doc_orig, DV.nro_orig, DV.n_control, 
			--CASE WHEN (DV.co_tipo_doc = 'N/CR') THEN DV.total_bruto * -1 ELSE DV.total_bruto END as total_bruto, 
			--CASE WHEN (DV.co_tipo_doc = 'N/CR') THEN DV.monto_imp * -1 ELSE DV.monto_imp END as monto_imp,
			DV.total_bruto,DV.monto_imp,
            DV.monto_desc_glob, DV.porc_desc_glob, DV.monto_reca, DV.porc_reca,
            ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros, null fec_emis_ori, null total_bruto_ori, null monto_imp_ori, null total_neto_ori,
			CASE WHEN ISNULL(DVI.base_imponible, 0) = 0 THEN 0.00 else ISNULL(DVI.base_imponible ,0) end as base_imponible,
			CASE WHEN ISNULL(DVI.base_imponible, 0) = 0 THEN 0.00 else ISNULL(DVI.porc_aplic,0) end as porc_aplic,
			CASE WHEN ISNULL(DVI.base_imponible, 0) > 0 THEN  DV.otros1 else 0 end as montoIGTF
        FROM
            saDocumentoCompra AS DV --INNER JOIN saDocumentoCompraReng AS DVR ON DVR.nro_doc = DV.nro_doc	
            INNER JOIN saProveedor AS CL ON CL.co_prov = DV.co_prov
			right join saDocumentoCompraInfoIGTF   DVI  ON     DVI.rowguid = DV.rowguid
		--INNER JOIN saVendedor AS VE ON VE.co_ven = DV.co_ven
		--INNER JOIN saTransporte AS TR ON TR.co_tran = DV.co_tran
		--LEFT JOIN saCondicionPago AS CP ON CP.co_cond = FV.co_cond	
		--INNER JOIN saMoneda AS MO ON MO.co_mone = DV.co_mone 
		--INNER JOIN saArticulo AS ART ON ART.co_art = DVR.co_art 
        WHERE
            ( ( @cCo_Numero_d IS NULL
```
