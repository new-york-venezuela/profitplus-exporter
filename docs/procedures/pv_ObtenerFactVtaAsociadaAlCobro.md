# SP: pv_ObtenerFactVtaAsociadaAlCobro
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pv_ObtenerFactVtaAsociadaAlCobro
*DESCRIPCIÓN	: VERIFICA SI EXISTE UN COBRO ASOCIADO AL NUMERO DE FACTURA QUE LLEGA POR PARAMETRO
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerFactVtaAsociadaAlCobro]
    (
		@sDoc_Num	CHAR (20)
    )
AS 
    BEGIN
		SELECT * FROM saCobroDocReng WHERE nro_doc = @sDoc_Num AND co_tipo_doc = 'FACT'
    END
```
