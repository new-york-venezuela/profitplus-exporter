# SP: RepFormatoNotaCreditoNotaDebitoVenta
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23/08/2022>
-- Description:
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoNotaCreditoNotaDebitoVenta] 
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
        SET @Tipo_doc = 'docuventa' ;
	
             SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1,
            CL.cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, VE.ven_des,
            DV.co_tipo_doc, DV.nro_doc, DV.co_cli, DV.co_ven, DV.co_mone, DV.tasa, DV.observa, DV.fec_emis, DV.fec_venc,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 'FACT' else DV.doc_orig end as doc_orig, 
            CASE WHEN (DV.doc_orig = 'DEVO') THEN (select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1) else DV.nro_orig end as nro_orig, 
             DV.n_control,
			-- CASE WHEN (DV.co_tipo_doc = 'N/CR') THEN DV.total_bruto * -1 ELSE DV.total_bruto END as total_bruto, 
			-- CASE WHEN (DV.co_tipo_doc = 'N/CR') THEN DV.monto_imp * -1 ELSE DV.monto_imp END as monto_imp, 
			DV.total_bruto, DV.monto_imp,			 
			  DV.monto_desc_glob, DV.porc_desc_glob,
            DV.monto_reca, DV.porc_reca, ( DV.otros1 + DV.otros2 + DV.otros3 ) AS otros,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select fec_emis from saDocumentoVenta where nro_doc =(select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1 AND (doc_orig='FACT' OR doc_orig='NENT'))) 
			WHEN (DV.co_tipo_doc = 'N/CR') THEN
				(select ISNULL(fec_emis, null) from saDocumentoVenta where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
			ELSE
				null 
			END AS fec_emis_ori,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select total_bruto from saDocumentoVenta where nro_doc =(select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1 and (doc_orig='FACT' OR doc_orig='NENT'))) 
			WHEN (DV.co_tipo_doc = 'N/CR') THEN
				(select ISNULL(total_bruto, null) from saDocumentoVenta where nro_doc
```
