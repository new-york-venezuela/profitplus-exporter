# SP: pv_ObtenerDevClienteXTipoOperacion
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerDevClienteXTipoOperacion]
*DESCRIPCIÓN	:	OBTIENE LOS DATOS DE UNA DE DEVOLUCION DE CLIENTE AL PROCESAR O REVERSAR UNA DEVOLUCION DE DINERO,
					DEVUELVE LOS VALORES QUE SON VALIDADOS PARA PROCESAR O NO LA DEVOLUCION DE DINERO EN PROCESO.
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerDevClienteXTipoOperacion]
    (
      @sNro_Doc				CHAR(20),
	  @sTipo_Operacion		CHAR(6)
    )
AS 
    BEGIN

		IF @sTipo_Operacion = 'PRODEV'  
				SELECT
				DC.rowguid, DC.co_tipo_doc, DC.nro_doc, DC.mov_num_c, DC.anulado, dv.saldo, dv.fec_emis
			FROM
				saDevolucionCliente DC
				INNER JOIN saDocumentoVenta dv ON DC.nro_doc = dv.nro_doc AND 
				DC.co_tipo_doc = dv.co_tipo_doc
			WHERE
			DC.mov_num_c IS NULL 
			AND DC.doc_num = @sNro_Doc
			AND DV.doc_orig = 'DEVO'
		ELSE 
			SELECT
				DC.rowguid, DC.co_tipo_doc, DC.nro_doc, DC.mov_num_c, DC.anulado, dv.saldo, dv.fec_emis
			FROM
				saDevolucionCliente DC
				INNER JOIN saDocumentoVenta dv ON DC.nro_doc = dv.nro_doc AND 
				DC.co_tipo_doc = dv.co_tipo_doc
			WHERE
			DC.mov_num_c IS NOT NULL 
			AND DC.doc_num = @sNro_Doc	
			AND DV.doc_orig = 'DEVO'
    END
```
