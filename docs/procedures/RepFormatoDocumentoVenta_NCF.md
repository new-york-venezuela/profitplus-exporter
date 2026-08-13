# SP: RepFormatoDocumentoVenta_NCF
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)
- [`saSucursal`](../tables/saSucursal.md)
- [`saTipoComprobante`](../tables/saTipoComprobante.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/05/2019>
-- Last date Update: <2019-10-07>
-- Description:	Reporte para Documento de Venta NCF (Dominicana).
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoDocumentoVenta_NCF] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_Tip_d CHAR(6) = NULL ,
    @sCo_Tip_h CHAR(6) = NULL ,
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
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1,SUCU.sucur_des , SUCU.sucur_des as co_sucu_in,
            CL.cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, VE.ven_des,CL.fax,
            DV.co_tipo_doc,TD.descrip, DV.nro_doc, DV.co_cli, DV.co_ven, DV.co_mone, DV.tasa, DV.observa, DV.fec_emis, DV.fec_venc,NCF.ncf,C.co_tipo,C.des_tipo,Convert(Varchar(10),SEXT.fe_venc,103) as fe_venc_ncf, CL.campo1,  NCF.nro_doc_Ori, NCFF.ncf as ncf_afectado	,	
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 'FACT' else DV.doc_orig end as doc_orig, 
            CASE WHEN (DV.doc_orig = 'DEVO') THEN (select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1) else DV.nro_orig end as nro_orig, 
             DV.n_control, DV.total_bruto, DV.monto_imp, DV.monto_desc_glob, DV.porc_desc_glob,
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
				(select ISNULL(total_bruto, null) from saDocumentoVenta w
```
