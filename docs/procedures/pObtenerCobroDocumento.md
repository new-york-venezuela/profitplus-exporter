# SP: pObtenerCobroDocumento
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saGiroVenta`](../tables/saGiroVenta.md)
- [`saGiroVentaReng`](../tables/saGiroVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: [pObtenerCobroDocumento]
DESCRIPCION	: Obtiene el monto total de los cobros para un documento
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 10/02/2020
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerCobroDocumento]
    (
      @snro_doc CHAR(20) ,
      @sco_tipo_doc CHAR(6)
    )
AS 
     BEGIN

		SELECT (isnull(sum(cfp.mont_doc), 0.00) + 
				( SELECT isnull(sum(gvr.monto_cob), 0.00) as monto_cobros 
				  FROM saGiroVentaReng gvr 
					INNER JOIN saGiroVenta gv 
						ON gv.co_giro = gvr.co_giro 
						AND gv.procesado = 1 
					INNER JOIN saDocumentoVenta dv 
						ON dv.nro_doc = gvr.nro_doc 
				  WHERE gvr.nro_doc = @snro_doc 
					AND gvr.co_tipo_doc = @sco_tipo_doc 
					AND gvr.monto_cob = dv.total_neto))as monto_cobros 
				  FROM saDocumentoVenta dv 
				  -- kdc >> 
					INNER JOIN dbo.saCobroDocReng cr ON (dv.nro_doc = cr.nro_doc AND cr.co_tipo_doc = @sco_tipo_doc)  
					INNER JOIN dbo.saCobro cb ON cr.cob_num = cb.cob_num 
					INNER JOIN dbo.saCobroTPReng cfp ON cb.cob_num = cfp.cob_num	
					--<<<				
				WHERE dv.nro_doc = @snro_doc 
					AND dv.co_tipo_doc = @sco_tipo_doc and cb.anulado = 0

    END
```
