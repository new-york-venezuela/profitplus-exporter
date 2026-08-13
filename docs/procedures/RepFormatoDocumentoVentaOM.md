# SP: RepFormatoDocumentoVentaOM
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02/25/2011>
-- Description:	<Reporte de Formato de Documentos de Ventas OM>
-- =============================================


CREATE PROCEDURE [dbo].[RepFormatoDocumentoVentaOM] 

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

        DECLARE @Tipo_doc CHAR(11) ;
        SET @Tipo_doc = 'docuventa' ;
	

	



        SELECT
            @Tipo_doc AS TIPO_DOC, 'tipo' = 1, CL.cli_des, CL.rif, CL.telefonos, CL.direc1, CL.direc2, VE.ven_des,
            DV.co_tipo_doc, DV.nro_doc, DV.co_cli, DV.co_ven, DV.co_mone, DV.tasa, DV.observa, DV.fec_emis, DV.fec_venc,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 'FACT' else DV.doc_orig end as doc_orig, 
            CASE WHEN (DV.doc_orig = 'DEVO') THEN (select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1) else DV.nro_orig end as nro_orig, 
            DV.n_control, DV.total_bruto / DV.tasa AS total_bruto,
            DV.monto_imp / DV.tasa AS monto_imp, DV.monto_desc_glob / DV.tasa AS monto_desc_glob, DV.porc_desc_glob,
            DV.monto_reca / DV.tasa AS monto_reca, DV.porc_reca,
            ( ( DV.otros1 / DV.tasa ) + ( DV.otros2 / DV.tasa ) + ( DV.otros3 / DV.tasa ) ) AS otros,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select fec_emis from saDocumentoVenta where nro_doc =(select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig and reng_num = 1 AND (doc_orig='FACT' OR doc_orig='NENT'))) 
			WHEN (DV.co_tipo_doc = 'N/CR') THEN
				(select ISNULL(fec_emis, null) from saDocumentoVenta where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
--Inicia sit 119637 jortiz 18/10/22
            WHEN (DV.co_tipo_doc = 'N/DB') THEN
				(select ISNULL(fec_emis, null) from saDocumentoVenta where nro_doc = DV.nro_orig and co_tipo_doc= DV.doc_orig) 
--Inicia sit 119637 jortiz 18/10/22		
			ELSE
				null 
			END AS fec_emis_ori,
            CASE WHEN (DV.doc_orig = 'DEVO') THEN 
				(select total_bruto from saDocumentoVenta where nro_doc =(select num_doc from saDevolucionClienteReng where doc_num = DV.nro_orig
```
