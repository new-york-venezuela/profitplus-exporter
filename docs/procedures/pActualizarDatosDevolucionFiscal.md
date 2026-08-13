# SP: pActualizarDatosDevolucionFiscal
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarDatosDevolucionFiscal]
/******************************************************************************
* Stored Procedure : Actualiza los datos fiscales en la Devolucion               *
* Desarrollador    : Softech Sistemas.                                           *
******************************************************************************/
    (
      @Dprofit CHAR(20) ,
      @impfis CHAR(20) ,
      @impfisfac CHAR(20) ,
      @ultZ CHAR(15)
    )
AS 
    BEGIN

        UPDATE
            saDevolucionCliente
        SET impfis = @impfis, impfisfac = @impfisfac , imp_nro_z = @ultZ
        WHERE
            doc_num = @Dprofit

        UPDATE
            saDocumentoVenta
        SET impfis = @impfis, impfisfac = @impfisfac, imp_nro_z = @ultZ
        WHERE
           -- nro_doc = @Dprofit 
		   --kdc >> En documento venta debe consultar por nro_origen
		      nro_orig = @Dprofit --<< 

		     AND co_tipo_doc = 'N/CR'
    END
```
