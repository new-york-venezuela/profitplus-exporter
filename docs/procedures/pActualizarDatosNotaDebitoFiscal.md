# SP: pActualizarDatosNotaDebitoFiscal
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarDatosNotaDebitoFiscal]
/******************************************************************************
* Stored Procedure : Actualiza los datos fiscales en la Nota de Debito               *
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
            saDocumentoVenta
        SET impfis = @impfis, impfisfac = @impfisfac, imp_nro_z = @ultZ
        WHERE
           -- nro_doc = @Dprofit 
		   --kdc >> En documento venta debe consultar por nro_origen
		      nro_doc = @Dprofit --<< 

		     AND co_tipo_doc = 'N/DB'
    END
```
