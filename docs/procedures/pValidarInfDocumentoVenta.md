# SP: pValidarInfDocumentoVenta
**Tipo**: Validar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidarInfDocumentoVenta]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Validar si el movimiento de pago se encuentra conciliado
***********************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarInfDocumentoVenta] ( @sNro_Doc CHAR(20) , @sTipo_Doc CHAR(6))
AS 
    BEGIN
	
        SELECT   DV.nro_doc          
        FROM    dbo.saNCFInfoDocVenta DV
        WHERE   DV.nro_doc = @sNro_Doc AND DV.tipo_doc = @sTipo_Doc
	
    END
```
