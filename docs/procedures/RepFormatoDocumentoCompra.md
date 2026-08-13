# SP: RepFormatoDocumentoCompra
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/25/2011>
-- Description:	<Reporte de Formato de Documentos de Compras>
-- =============================================


CREATE PROCEDURE [dbo].[RepFormatoDocumentoCompra] 
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
            DV.fec_emis, DV.fec_venc, DV.doc_orig, DV.nro_orig, DV.n_control, DV.total_bruto, DV.monto_imp,
            DV.monto_desc_glob, DV.porc_desc_glob, DV.monto_reca, DV.porc_reca,
            ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros, 
			  --  null fec_emis_ori, null total_bruto_ori, null monto_imp_ori, null total_neto_ori
		 --inicia sit 120762 jortiz
		   CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select fec_emis from saDocumentoCompra where nro_doc =(select num_doc from saDevolucionProveedorReng where doc_num = DV.nro_orig and reng_num = 1 AND (doc_orig='FACT' OR doc_orig='NENT'))) 
			WHEN (DV.co_tipo_doc = 'N/CR') THEN
				(select ISNULL(fec_emis, null) from saDocumentoCompra where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
		    WHEN (DV.co_tipo_doc = 'N/DB') THEN
				(select ISNULL(fec_emis, null) from saDocumentoCompra where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
           
			ELSE
				null 
			END AS fec_emis_ori,

			 CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select total_bruto from saDocumentoCompra where nro_doc =(select num_doc from saDevolucionProveedorReng where doc_num = DV.nro_orig and reng_num = 1 and (doc_orig='FACT' OR doc_orig='NENT'))) 
			WHEN (DV.co_tipo_doc = 'N/CR') THEN
				(select ISNULL(total_bruto, null) from saDocumentoCompra where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
			
       
            WHEN (DV.co_tipo_doc = 'N/DB') THE
```
