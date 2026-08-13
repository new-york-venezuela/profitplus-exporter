# SP: pValidarInfDocumentoCompra
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidarInfDocumentoCompra]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Validar si el movimiento de pago se encuentra conciliado
***********************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarInfDocumentoCompra] ( @sNro_Doc CHAR(20) , @sTipo_Doc CHAR(6))
AS 
    BEGIN
	
        SELECT   DC.nro_doc          
        FROM    dbo.saNCFInfoDocCompra DC
        WHERE   DC.nro_doc = @sNro_Doc AND DC.tipo_doc = @sTipo_Doc
	
    END
```
