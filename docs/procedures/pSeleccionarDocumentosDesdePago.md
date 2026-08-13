# SP: pSeleccionarDocumentosDesdePago
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarDocumentosDesdePago
DESCRIPCION	: Seleccionar los documentos generados desde determinado pago
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 25/02/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDocumentosDesdePago]
    (
      @sNro_Orig CHAR(20) ,
      @sDoc_Orig CHAR(6)
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saDocumentoCompra
        WHERE
            Nro_Orig = @sNro_Orig
            AND Doc_Orig = @sDoc_Orig
						
	
    END
```
