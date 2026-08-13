# SP: pv_ObtenerCobroDevolucion
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerCobroDevolucion]
*DESCRIPCIÓN	:	OBTIENE EL NUMERO DE COBRO Y DE DOCUMENTO GENERADO DESDE UNA DEVOLUCION DE DINERO (AL PROCESAR O REVERSAR LA MISMA)
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerCobroDevolucion]
    (
      @sNroDoc		CHAR(20),
	  @sTipoDoc		CHAR (6)
    )
AS 
    BEGIN
		SELECT ren.cob_num, ren.nro_doc
			FROM saCobrodocReng ren
			inner join saCobro cob on cob.cob_num = ren.cob_num
				WHERE ren.co_tipo_doc = @sTipoDoc AND  ren.cob_num IN (SELECT cob_num FROM saCobroDocReng WHERE nro_doc = @sNroDoc)
				AND COB.anulado = 0
	END
```
