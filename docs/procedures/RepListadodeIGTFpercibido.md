# SP: RepListadodeIGTFpercibido
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23/08/2010>
-- Description:
-- =============================================
CREATE PROCEDURE [dbo].[RepListadodeIGTFpercibido]
(
@dfecha_d date,	
@dfecha_h date,
@sCampOrderBy VARCHAR(16) = NULL,
@sDir VARCHAR(6) = NULL ,
@bHeaderRep BIT = 0
)
 
 AS 
    BEGIN	

	select  B.co_tipo_doc,B.nro_doc as doc_num, B.fec_emis as fec_emis, B.observa,
	case when B.co_tipo_doc  = 'N/CR' then B.total_neto * -1  else B.total_neto end monto, 
	case when B.co_tipo_doc  = 'N/CR' then isnull(C.base_imponible,0) * -1  else isnull(C.base_imponible,0) end   as base_imponible,  
	isnull(C.porc_aplic,0) as porc_aplic, 
	case when B.co_tipo_doc  = 'N/CR' then B.otros1 * -1  else B.otros1 end as IGTF,
	B.fe_us_in 
	 
	 from --saFacturaVenta as A
		--inner join saDocumentoVenta as B ON B.nro_doc = A.doc_num and co_tipo_doc in('FACT','N/CR','N/DB') -- JO 06062022
		saDocumentoVenta as B  
	    inner join saDocumentoVentaInfoIGTF as C ON  C.rowguid= B.rowguid
	where 
	  ( B.co_tipo_doc ='FACT' or ( B.co_tipo_doc in('N/CR','N/DB') and b.aut=0) )-- JO 06062022
	 and (@dfecha_d is null or dbo.FechaSimple(B.fec_emis)>= @dfecha_d)
	 and (@dfecha_h is null or dbo.FechaSimple(B.fec_emis)<= @dfecha_h)
	 and C.base_imponible > 0	
	 and B.anulado = 0

	 	union
	


	 select co_tipo_doc,nro_doc, fec_emis as fec_emis, CONCAT(doc_orig, ' ', nro_orig) as observa, 0.00 as monto, 0.00 as base_imponible, [dbo].[pObtenerFechaImpuesto_nuevo]('IGTFP', fec_emis) as porc_aplic,
	    case when  co_tipo_doc = 'IGTFN' then total_neto * -1 
	         when co_tipo_doc = 'IGTFP' then total_neto  
	    end
	 as IGTF, fe_us_in 
	 from saDocumentoVenta 
		where
		(@dfecha_d is null or dbo.FechaSimple(fec_emis)>= @dfecha_d)
	 and (@dfecha_h is null or dbo.FechaSimple(fec_emis)<= @dfecha_h)
	 and (co_tipo_doc = 'IGTFP' or co_tipo_doc = 'IGTFN')
	 and anulado = 0

	 	
	union

	
	select  Vent.co_tipo_doc, Vent.nro_doc, Vent.fec_emis as fec_emis  , Vent.observa, Vent.total_neto* -1 as monto,
	
	
	case 
	     when Vent.co_tipo_doc  = 'N/CR' 
		     then isnull(VentIGTF.base_imponible,0) * -1  
		 else isnull(VentIGTF.base_imponible,0) 
    end  as base_imponible, isnull(VentIGTF.porc_aplic,0.00) as porc_aplic, 
	 case -- en caso de que mostrar nota de credito se multiplica por -1 para que se meustre negativo
	     when Vent.co_tipo_doc = 'N/CR' 
	     then Dev.ot
```
